const videoWidth = window.innerWidth * 0.8;
const videoHeight = window.innerHeight * 0.8;
const stats = new Stats();

const NOSE = 0;
const LEFTEYE = 1;
const RIGHTEYE = 2;
const LEFTEAR = 3;
const RIGHTEAR = 4;
const LEFTSHOULDER = 5;
const RIGHTSHOULDER = 6;
const LEFTELBOW = 7;
const RIGHTELBOW = 8;
const LEFTWRIST = 9;
const RIGHTWRIST = 10;
const LEFTHIP = 11;
const RIGHTHIP = 12;
const LEFTKNEE = 13;
const RIGHTKNEE = 14;
const LEFTANKLE = 15;
const RIGHTANKLE = 16;

const UP = 1;
const DOWN = 2;
const LEFT = 3;
const RIGHT = 4;

const EXTENDED = 0;
const FOLDED = 1;
const UNKNOWN = -1;

const ANG_LELBOW = 0;
const ANG_RELBOW = 1;
const ANG_LSHOULDER = 2;
const ANG_RSHOULDER = 3
const ANG_LSHOULDERW = 4;
const ANG_RSHOULDERW = 5;
const ANG_LSHOULDERWN = 6;
const ANG_RSHOULDERWN = 7;

const LEFTHAND_UPDOWN = 0;
const RIGHTHAND_UPDOWN = 1;
const LEFTHAND_LR = 2;
const RIGHTHAND_LR = 3;

let genkaku = -1;
let count = 0;
let seq_genkaku = [];
let curText = '';
let score = 0;
let bpface = new Image();
let navScale = 1
bpface.src = "bp_face.png"

/**
 * Loads a the camera to be used in the demo
 *
 */
async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error(
        'Browser API navigator.mediaDevices.getUserMedia not available');
  }

  const video = document.getElementById('video');
  video.width = videoWidth;
  video.height = videoHeight;

  const mobile = isMobile();
  const stream = await navigator.mediaDevices.getUserMedia({
    'audio': false,
    'video': {
      facingMode: 'user',
      width: mobile ? undefined : videoWidth,
      height: mobile ? undefined : videoHeight,
    },
  });
  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

async function loadVideo() {
  const video = await setupCamera();
  video.play();

  return video;
}

const defaultQuantBytes = 2;

const defaultMobileNetMultiplier = isMobile() ? 0.50 : 0.75;
const defaultMobileNetStride = 16;
const defaultMobileNetInputResolution = 500;

const defaultResNetMultiplier = 1.0;
const defaultResNetStride = 32;
const defaultResNetInputResolution = 250;

const guiState = {
  algorithm: 'single-pose',
  input: {
    architecture: 'MobileNetV1',
    outputStride: defaultMobileNetStride,
    inputResolution: defaultMobileNetInputResolution,
    multiplier: defaultMobileNetMultiplier,
    quantBytes: defaultQuantBytes
  },
  singlePoseDetection: {
    minPoseConfidence: 0.1,
    minPartConfidence: 0.5,
  },
  multiPoseDetection: {
    maxPoseDetections: 5,
    minPoseConfidence: 0.15,
    minPartConfidence: 0.1,
    nmsRadius: 30.0,
  },
  output: {
    showVideo: true,
    showSkeleton: true,
    showPoints: true,
    showBoundingBox: false,
    showBP: false,
    showDebugText: false,
  },
  net: null,
};

/**
 * Sets up dat.gui controller on the top-right of the window
 */
function setupGui(cameras, net) {
  guiState.net = net;

  if (cameras.length > 0) {
    guiState.camera = cameras[0].deviceId;
  }

  const gui = new dat.GUI({width: 300});

  let architectureController = null;
  guiState[tryResNetButtonName] = function() {
    architectureController.setValue('ResNet50')
  };
  gui.add(guiState, tryResNetButtonName).name(tryResNetButtonText);
  updateTryResNetButtonDatGuiCss();

  // The single-pose algorithm is faster and simpler but requires only one
  // person to be in the frame or results will be innaccurate. Multi-pose works
  // for more than 1 person
  const algorithmController =
      gui.add(guiState, 'algorithm', ['single-pose', 'multi-pose']);

  // The input parameters have the most effect on accuracy and speed of the
  // network
  let input = gui.addFolder('Input');
  // Architecture: there are a few PoseNet models varying in size and
  // accuracy. 1.01 is the largest, but will be the slowest. 0.50 is the
  // fastest, but least accurate.
  architectureController =
      input.add(guiState.input, 'architecture', ['MobileNetV1', 'ResNet50']);
  guiState.architecture = guiState.input.architecture;
  // Input resolution:  Internally, this parameter affects the height and width
  // of the layers in the neural network. The higher the value of the input
  // resolution the better the accuracy but slower the speed.
  let inputResolutionController = null;
  function updateGuiInputResolution(
      inputResolution,
      inputResolutionArray,
  ) {
    if (inputResolutionController) {
      inputResolutionController.remove();
    }
    guiState.inputResolution = inputResolution;
    guiState.input.inputResolution = inputResolution;
    inputResolutionController =
        input.add(guiState.input, 'inputResolution', inputResolutionArray);
    inputResolutionController.onChange(function(inputResolution) {
      guiState.changeToInputResolution = inputResolution;
    });
  }

  // Output stride:  Internally, this parameter affects the height and width of
  // the layers in the neural network. The lower the value of the output stride
  // the higher the accuracy but slower the speed, the higher the value the
  // faster the speed but lower the accuracy.
  let outputStrideController = null;
  function updateGuiOutputStride(outputStride, outputStrideArray) {
    if (outputStrideController) {
      outputStrideController.remove();
    }
    guiState.outputStride = outputStride;
    guiState.input.outputStride = outputStride;
    outputStrideController =
        input.add(guiState.input, 'outputStride', outputStrideArray);
    outputStrideController.onChange(function(outputStride) {
      guiState.changeToOutputStride = outputStride;
    });
  }

  // Multiplier: this parameter affects the number of feature map channels in
  // the MobileNet. The higher the value, the higher the accuracy but slower the
  // speed, the lower the value the faster the speed but lower the accuracy.
  let multiplierController = null;
  function updateGuiMultiplier(multiplier, multiplierArray) {
    if (multiplierController) {
      multiplierController.remove();
    }
    guiState.multiplier = multiplier;
    guiState.input.multiplier = multiplier;
    multiplierController =
        input.add(guiState.input, 'multiplier', multiplierArray);
    multiplierController.onChange(function(multiplier) {
      guiState.changeToMultiplier = multiplier;
    });
  }

  // QuantBytes: this parameter affects weight quantization in the ResNet50
  // model. The available options are 1 byte, 2 bytes, and 4 bytes. The higher
  // the value, the larger the model size and thus the longer the loading time,
  // the lower the value, the shorter the loading time but lower the accuracy.
  let quantBytesController = null;
  function updateGuiQuantBytes(quantBytes, quantBytesArray) {
    if (quantBytesController) {
      quantBytesController.remove();
    }
    guiState.quantBytes = +quantBytes;
    guiState.input.quantBytes = +quantBytes;
    quantBytesController =
        input.add(guiState.input, 'quantBytes', quantBytesArray);
    quantBytesController.onChange(function(quantBytes) {
      guiState.changeToQuantBytes = +quantBytes;
    });
  }

  function updateGui() {
    if (guiState.input.architecture === 'MobileNetV1') {
      updateGuiInputResolution(
          defaultMobileNetInputResolution,
          [200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800]);
      updateGuiOutputStride(defaultMobileNetStride, [8, 16]);
      updateGuiMultiplier(defaultMobileNetMultiplier, [0.50, 0.75, 1.0]);
    } else {  // guiState.input.architecture === "ResNet50"
      updateGuiInputResolution(
          defaultResNetInputResolution,
          [200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800]);
      updateGuiOutputStride(defaultResNetStride, [32, 16]);
      updateGuiMultiplier(defaultResNetMultiplier, [1.0]);
    }
    updateGuiQuantBytes(defaultQuantBytes, [1, 2, 4]);
  }

  updateGui();
  //input.open();
  // Pose confidence: the overall confidence in the estimation of a person's
  // pose (i.e. a person detected in a frame)
  // Min part confidence: the confidence that a particular estimated keypoint
  // position is accurate (i.e. the elbow's position)
  let single = gui.addFolder('Single Pose Detection');
  single.add(guiState.singlePoseDetection, 'minPoseConfidence', 0.0, 1.0);
  single.add(guiState.singlePoseDetection, 'minPartConfidence', 0.0, 1.0);
  single.open();

  let multi = gui.addFolder('Multi Pose Detection');
  multi.add(guiState.multiPoseDetection, 'maxPoseDetections')
      .min(1)
      .max(20)
      .step(1);
  multi.add(guiState.multiPoseDetection, 'minPoseConfidence', 0.0, 1.0);
  multi.add(guiState.multiPoseDetection, 'minPartConfidence', 0.0, 1.0);
  // nms Radius: controls the minimum distance between poses that are returned
  // defaults to 20, which is probably fine for most use cases
  multi.add(guiState.multiPoseDetection, 'nmsRadius').min(0.0).max(40.0);
  //multi.open();

  let output = gui.addFolder('Output');
  output.add(guiState.output, 'showVideo');
  output.add(guiState.output, 'showSkeleton');
  output.add(guiState.output, 'showPoints');
  output.add(guiState.output, 'showBoundingBox');
  output.add(guiState.output, 'showBP');
  output.add(guiState.output, 'showDebugText');
  output.open();


  architectureController.onChange(function(architecture) {
    // if architecture is ResNet50, then show ResNet50 options
    updateGui();
    guiState.changeToArchitecture = architecture;
  });

  algorithmController.onChange(function(value) {
    switch (guiState.algorithm) {
      case 'single-pose':
        multi.close();
        single.open();
        break;
      case 'multi-pose':
        single.close();
        multi.open();
        break;
    }
  });
}

/**
 * Sets up a frames per second panel on the top-left of the window
 */
function setupFPS() {
  stats.showPanel(0);  // 0: fps, 1: ms, 2: mb, 3+: custom
  document.getElementById('main').appendChild(stats.dom);
}

/**
 * Feeds an image to posenet to estimate poses - this is where the magic
 * happens. This function loops with a requestAnimationFrame method.
 */
function detectPoseInRealTime(video, net) {
  const canvas = document.getElementById('output');
  const ctx = canvas.getContext('2d');

  // since images are being fed from a webcam, we want to feed in the
  // original image and then just flip the keypoints' x coordinates. If instead
  // we flip the image, then correcting left-right keypoint pairs requires a
  // permutation on all the keypoints.
  const flipPoseHorizontal = false;

  canvas.width = videoWidth;
  canvas.height = videoHeight;

  async function poseDetectionFrame() {
    if (guiState.changeToArchitecture) {
      // Important to purge variables and free up GPU memory
      guiState.net.dispose();
      toggleLoadingUI(true);
      guiState.net = await posenet.load({
        architecture: guiState.changeToArchitecture,
        outputStride: guiState.outputStride,
        inputResolution: guiState.inputResolution,
        multiplier: guiState.multiplier,
      });
      toggleLoadingUI(false);
      guiState.architecture = guiState.changeToArchitecture;
      guiState.changeToArchitecture = null;
    }

    if (guiState.changeToMultiplier) {
      guiState.net.dispose();
      toggleLoadingUI(true);
      guiState.net = await posenet.load({
        architecture: guiState.architecture,
        outputStride: guiState.outputStride,
        inputResolution: guiState.inputResolution,
        multiplier: +guiState.changeToMultiplier,
        quantBytes: guiState.quantBytes
      });
      toggleLoadingUI(false);
      guiState.multiplier = +guiState.changeToMultiplier;
      guiState.changeToMultiplier = null;
    }

    if (guiState.changeToOutputStride) {
      // Important to purge variables and free up GPU memory
      guiState.net.dispose();
      toggleLoadingUI(true);
      guiState.net = await posenet.load({
        architecture: guiState.architecture,
        outputStride: +guiState.changeToOutputStride,
        inputResolution: guiState.inputResolution,
        multiplier: guiState.multiplier,
        quantBytes: guiState.quantBytes
      });
      toggleLoadingUI(false);
      guiState.outputStride = +guiState.changeToOutputStride;
      guiState.changeToOutputStride = null;
    }

    if (guiState.changeToInputResolution) {
      // Important to purge variables and free up GPU memory
      guiState.net.dispose();
      toggleLoadingUI(true);
      guiState.net = await posenet.load({
        architecture: guiState.architecture,
        outputStride: guiState.outputStride,
        inputResolution: +guiState.changeToInputResolution,
        multiplier: guiState.multiplier,
        quantBytes: guiState.quantBytes
      });
      toggleLoadingUI(false);
      guiState.inputResolution = +guiState.changeToInputResolution;
      guiState.changeToInputResolution = null;
    }

    if (guiState.changeToQuantBytes) {
      // Important to purge variables and free up GPU memory
      guiState.net.dispose();
      toggleLoadingUI(true);
      guiState.net = await posenet.load({
        architecture: guiState.architecture,
        outputStride: guiState.outputStride,
        inputResolution: guiState.inputResolution,
        multiplier: guiState.multiplier,
        quantBytes: guiState.changeToQuantBytes
      });
      toggleLoadingUI(false);
      guiState.quantBytes = guiState.changeToQuantBytes;
      guiState.changeToQuantBytes = null;
    }

    // Begin monitoring code for frames per second
    stats.begin();

    let poses = [];
    let minPoseConfidence;
    let minPartConfidence;
    switch (guiState.algorithm) {
      case 'single-pose':
        const pose = await guiState.net.estimatePoses(video, {
          flipHorizontal: flipPoseHorizontal,
          decodingMethod: 'single-person'
        });
        poses = poses.concat(pose);
        minPoseConfidence = +guiState.singlePoseDetection.minPoseConfidence;
        minPartConfidence = +guiState.singlePoseDetection.minPartConfidence;
        break;
      case 'multi-pose':
        let all_poses = await guiState.net.estimatePoses(video, {
          flipHorizontal: flipPoseHorizontal,
          decodingMethod: 'multi-person',
          maxDetections: guiState.multiPoseDetection.maxPoseDetections,
          scoreThreshold: guiState.multiPoseDetection.minPartConfidence,
          nmsRadius: guiState.multiPoseDetection.nmsRadius
        });

        poses = poses.concat(all_poses);
        minPoseConfidence = +guiState.multiPoseDetection.minPoseConfidence;
        minPartConfidence = +guiState.multiPoseDetection.minPartConfidence;
        break;
    }

    ctx.clearRect(0, 0, videoWidth, videoHeight);

    if (guiState.output.showVideo) {
      ctx.save();
      //ctx.scale(-1, 1);
      //ctx.translate(-videoWidth, 0);
      ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
      ctx.restore();
    }

    let exwidth = (videoWidth > videoHeight)? videoWidth: videoHeight;
    let genkakupoint = Math.floor(exwidth/4);
    let genkakusize = Math.floor(exwidth/3);
    let strsize = Math.floor(exwidth/10);

    // For each pose (i.e. person) detected in an image, loop through the poses
    // and draw the resulting skeleton and keypoints if over certain confidence
    // scores
    poses.forEach(({score, keypoints}) => {
      if (score >= minPoseConfidence) {
        if (guiState.output.showPoints) {
          drawKeypoints(keypoints, minPartConfidence, ctx);
        }
        if (guiState.output.showSkeleton) {
          drawSkeleton(keypoints, minPartConfidence, ctx);
        }
        if (guiState.output.showBoundingBox) {
          drawBoundingBox(keypoints, ctx);
        }
        if (guiState.output.showBP){
          drawBP(keypoints[NOSE], keypoints[LEFTEYE], ctx);
        }
        if (guiState.output.showDebugText){
          drawDebugText(keypoints, minPartConfidence, "blue", ctx);
        }
      }

      result = judge_genkaku(keypoints, minPartConfidence);
      if(result != -1){
          if(genkaku == result){
              count++;
              if(count == 5){
                  seq_genkaku.push(genkaku);
              }
          }
          else{
              genkaku = result;
              count = 0;
          }

          if( result == 0){
              curText = judge_kana(curText, seq_genkaku);
              seq_genkaku.splice(0);
          }

          if(count > 4){
              ctx.font = "bold " + genkakusize.toString() + "px sans-serif";
              ctx.fillStyle = "white";
              ctx.fillText(genkaku, genkakupoint, strsize+20+genkakusize);
          }
      }

      // draw strings
      ctx.font = "bold " + strsize.toString() + "px sans-serif";
      ctx.fillStyle = "red";
      ctx.fillText(curText, 10, strsize + 5);
      ctx.fill();

    });

    // End monitoring code for frames per second
    stats.end();

    requestAnimationFrame(poseDetectionFrame);
  }

  poseDetectionFrame();
}

/**
 * Kicks off the demo by loading the posenet model, finding and loading
 * available camera devices, and setting off the detectPoseInRealTime function.
 */
async function bindPage() {
  toggleLoadingUI(true);
  const net = await posenet.load({
    architecture: guiState.input.architecture,
    outputStride: guiState.input.outputStride,
    inputResolution: guiState.input.inputResolution,
    multiplier: guiState.input.multiplier,
    quantBytes: guiState.input.quantBytes
  });
  toggleLoadingUI(false);

  let video;

  try {
    video = await loadVideo();
  } catch (e) {
    let info = document.getElementById('info');
    info.textContent = 'this browser does not support video capture,' +
        'or this device does not have a camera';
    info.style.display = 'block';
    throw e;
  }

  setupGui([], net);
  //setupFPS();
  detectPoseInRealTime(video, net);
}

navigator.getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
// kick off the demo
bindPage();

const color = 'aqua';
const boundingBoxColor = 'red';
const lineWidth = 2;

const tryResNetButtonName = 'tryResNetButton';
const tryResNetButtonText = '[New] Try ResNet50';
const tryResNetButtonTextCss = 'width:100%;text-decoration:underline;';
const tryResNetButtonBackgroundCss = 'background:#e61d5f;';

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function isiOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isMobile() {
  return isAndroid() || isiOS();
}

function setDatGuiPropertyCss(propertyText, liCssString, spanCssString = '') {
  var spans = document.getElementsByClassName('property-name');
  for (var i = 0; i < spans.length; i++) {
    var text = spans[i].textContent || spans[i].innerText;
    if (text == propertyText) {
      spans[i].parentNode.parentNode.style = liCssString;
      if (spanCssString !== '') {
        spans[i].style = spanCssString;
      }
    }
  }
}

function updateTryResNetButtonDatGuiCss() {
  setDatGuiPropertyCss(
      tryResNetButtonText, tryResNetButtonBackgroundCss,
      tryResNetButtonTextCss);
}

/**
 * Toggles between the loading UI and the main canvas UI.
 */
function toggleLoadingUI(
    showLoadingUI, loadingDivId = 'loading', mainDivId = 'main') {
  if (showLoadingUI) {
    document.getElementById(loadingDivId).style.display = 'block';
    document.getElementById(mainDivId).style.display = 'none';
  } else {
    document.getElementById(loadingDivId).style.display = 'none';
    document.getElementById(mainDivId).style.display = 'block';
  }
}

function toTuple({y, x}) {
  return [y, x];
}

function drawPoint(ctx, y, x, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * Draws a line on a canvas, i.e. a joint
 */
function drawSegment([ay, ax], [by, bx], color, scale, ctx) {
  ctx.beginPath();
  ctx.moveTo(ax * scale, ay * scale);
  ctx.lineTo(bx * scale, by * scale);
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/**
 * Draws a pose skeleton by looking up all adjacent keypoints/joints
 */
function drawSkeleton(keypoints, minConfidence, ctx, scale = 1) {
  const adjacentKeyPoints =
      posenet.getAdjacentKeyPoints(keypoints, minConfidence);

  adjacentKeyPoints.forEach((keypoints) => {
    drawSegment(
        toTuple(keypoints[0].position), toTuple(keypoints[1].position), color,
        scale, ctx);
  });
}

/**
 * Draw pose keypoints onto a canvas
 */
function drawKeypoints(keypoints, minConfidence, ctx, scale = 1) {
  for (let i = 0; i < keypoints.length; i++) {
    const keypoint = keypoints[i];

    if (keypoint.score < minConfidence) {
      continue;
    }

    const {y, x} = keypoint.position;
    drawPoint(ctx, y * scale, x * scale, 3, color);
  }
}

/**
 * Draw the bounding box of a pose. For example, for a whole person standing
 * in an image, the bounding box will begin at the nose and extend to one of
 * ankles
 */
function drawBoundingBox(keypoints, ctx) {
  const boundingBox = posenet.getBoundingBox(keypoints);

  ctx.rect(
      boundingBox.minX, boundingBox.minY, boundingBox.maxX - boundingBox.minX,
      boundingBox.maxY - boundingBox.minY);

  ctx.strokeStyle = boundingBoxColor;
  ctx.stroke();
}

/**
 * Used by the drawHeatMapValues method to draw heatmap points on to
 * the canvas
 */
function drawPoints(ctx, points, radius, color) {
  const data = points.buffer().values;

  for (let i = 0; i < data.length; i += 2) {
    const pointY = data[i];
    const pointX = data[i + 1];

    if (pointX !== 0 && pointY !== 0) {
      ctx.beginPath();
      ctx.arc(pointX, pointY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
}

function drawDebugText(keypoints, minConfidence, color, ctx) {
  let angles = getAngles(keypoints, minConfidence);

  ctx.font = "18px sans-serif";
  ctx.fillStyle = color;
  ctx.fillText('[arm and nose angles]left: ' + angles[6].toFixed(1) + ', right: ' + angles[7].toFixed(1), 10, videoHeight - 80);
  ctx.fill();
  ctx.fillText('[Angles]', 10, videoHeight - 65)
  ctx.fill();
  ctx.fillText('left elbow: ' + angles[0].toFixed(1) + ', right elbow: ' + angles[1].toFixed(1) + ', left shoulder: ' + angles[2].toFixed(1) + ', right shoulder: ' + angles[3].toFixed(1), 20, videoHeight - 50);
  ctx.fill();
  ctx.fillText('[score]left wrist: ' + keypoints[LEFTWRIST].score.toFixed(3) + ' right wrist: ' + keypoints[RIGHTWRIST].score.toFixed(3), 10, videoHeight - 35);
  ctx.fill();
  ctx.fillText('[score]left elbow: ' + keypoints[LEFTELBOW].score.toFixed(3) + ' right elbow: ' + keypoints[RIGHTELBOW].score.toFixed(3), 10, videoHeight - 20);
  ctx.fill();
  ctx.fillText('[score]left shoulder: ' + keypoints[LEFTSHOULDER].score.toFixed(3) + ' right shoulder: ' + keypoints[RIGHTSHOULDER].score.toFixed(3), 10, videoHeight - 5);
  ctx.fill();
}

function drawBP(nose, leye, ctx){
  navScale = (leye.position.x - nose.position.x - 50) / 20;
  if (navScale < 1) navScale = 1;
  let nw = bpface.width * navScale;
  let nh = bpface.height * navScale;
  ctx.drawImage(bpface,nose.position.x - nw / 2 , nose.position.y - nh / 1.5, nw, nh);
}

function getAngles(keypoints, minConfidence) {
  var angles = [];

  // 左肘
  deg = calculateInternalAngle(keypoints, LEFTELBOW, LEFTWRIST, LEFTSHOULDER, minConfidence);
  angles.push(deg);

  // 右肘
  deg = calculateInternalAngle(keypoints, RIGHTELBOW, RIGHTWRIST, RIGHTSHOULDER, minConfidence);
  angles.push(deg);
 
  // 左肩（肘との内角）
  deg = calculateInternalAngle(keypoints, LEFTSHOULDER, LEFTELBOW, RIGHTSHOULDER, minConfidence);
  angles.push(deg);
 
  // 右肩（肘との内角）
  deg = calculateInternalAngle(keypoints, RIGHTSHOULDER, RIGHTELBOW, LEFTSHOULDER, minConfidence);
  angles.push(deg);

  // 左肩（手との内角）
  deg = calculateInternalAngle(keypoints, LEFTSHOULDER, LEFTWRIST, RIGHTSHOULDER, minConfidence);
  angles.push(deg);
 
  // 右肩（手との内角）
  deg = calculateInternalAngle(keypoints, RIGHTSHOULDER, RIGHTWRIST, LEFTSHOULDER, minConfidence);
  angles.push(deg);

  // 左肩（手と鼻の内角）
  deg = calculateInternalAngle(keypoints, LEFTSHOULDER, NOSE, LEFTWRIST, minConfidence);
  angles.push(deg);

  // 右肩（手と鼻の内角）
  deg = calculateInternalAngle(keypoints, RIGHTSHOULDER, NOSE, RIGHTWRIST, minConfidence);
  angles.push(deg);

  return angles;
}

// 内角を求める
function calculateInternalAngle(keypoints, point0, point1, point2, confidence) {

   if(keypoints[point0].score < confidence || keypoints[point1].score < confidence || keypoints[point2].score < confidence){
       return -1;
   }
   var a = {x:keypoints[point1].position.x-keypoints[point0].position.x, y:keypoints[point1].position.y-keypoints[point0].position.y};
   var b = {x:keypoints[point2].position.x-keypoints[point0].position.x, y:keypoints[point2].position.y-keypoints[point0].position.y};
   
   var dot = a.x * b.x + a.y * b.y;
   
   var absA = Math.sqrt(a.x*a.x + a.y*a.y);
   var absB = Math.sqrt(b.x*b.x + b.y*b.y);
   
   //dot = |a||b|cosθという公式より
   var cosTheta = dot / (absA*absB);
   
   //cosθの逆関数
   var theta = Math.acos(cosTheta) * 180 / Math.PI;

   return theta;
}

function get_positions(keypoints, minConfidence) {
   positions = [];
   if((keypoints[LEFTELBOW].score > minConfidence) || (keypoints[LEFTWRIST].score > minConfidence)){
       if((keypoints[LEFTELBOW].score > minConfidence) && (keypoints[LEFTELBOW].position.y < keypoints[LEFTSHOULDER].position.y) ||
       (keypoints[LEFTWRIST].score > minConfidence) && (keypoints[LEFTWRIST].position.y < keypoints[LEFTSHOULDER].position.y)){
           positions.push(UP);
       }else{
           positions.push(DOWN);
       }
   }else{
       positions.push(0);
   }

   if((keypoints[RIGHTELBOW].score > minConfidence) || (keypoints[RIGHTWRIST].score > minConfidence)){
       if((keypoints[RIGHTELBOW].score > minConfidence) && (keypoints[RIGHTELBOW].position.y < keypoints[RIGHTSHOULDER].position.y) ||
       (keypoints[RIGHTWRIST].score > minConfidence) && (keypoints[RIGHTWRIST].position.y < keypoints[RIGHTSHOULDER].position.y)){
           positions.push(UP);
       }else{
           positions.push(DOWN);
       }
   }else{
       positions.push(0);
   }

   if(keypoints[LEFTWRIST].score > minConfidence){
       if(keypoints[LEFTWRIST].position.x > keypoints[LEFTSHOULDER].position.x){
           positions.push(LEFT);
       }else{
           positions.push(RIGHT);
       }
   }else{
       positions.push(0);
   }

   if(keypoints[RIGHTWRIST].score > minConfidence){
       if(keypoints[LEFTWRIST].position.x > keypoints[LEFTSHOULDER].position.x){
           positions.push(LEFT);
       }else{
           positions.push(RIGHT);
       }
   }else{
       positions.push(0);
   }

   return positions
}

function judge_genkaku(keypoints, minConfidence){
   angles = getAngles(keypoints, minConfidence);
   positions = get_positions(keypoints, minConfidence);

   if ( 150 < angles[ANG_LELBOW] &&
       150 < angles[ANG_RELBOW] &&
       (80 < angles[ANG_LSHOULDER] && angles[ANG_LSHOULDER] < 130) &&
       (80 < angles[ANG_RSHOULDER] && angles[ANG_RSHOULDER] < 130) &&
       positions[LEFTHAND_UPDOWN] == DOWN &&
       positions[RIGHTHAND_UPDOWN] == DOWN)
       return 0;
   else if ((155 < angles[ANG_LELBOW] &&
       155 < angles[ANG_RELBOW] &&
       155 < angles[ANG_LSHOULDER] &&
       155 < angles[ANG_RSHOULDER]) ||
       (155 < angles[ANG_LSHOULDERW] &&
       155 < angles[ANG_RSHOULDERW]))
       return 1;
   else if ((150 < angles[ANG_LELBOW] &&
       140 < angles[ANG_RELBOW] &&
       (80 < angles[ANG_LSHOULDER] && angles[ANG_LSHOULDER] < 145) &&
       (80 < angles[ANG_RSHOULDER] && angles[ANG_RSHOULDER] < 135) &&
       positions[LEFTHAND_UPDOWN] == DOWN &&
       positions[RIGHTHAND_UPDOWN] == UP) ||
       (150 < angles[ANG_LELBOW] &&
       (80 < angles[ANG_LSHOULDER] && angles[ANG_LSHOULDER] < 145) &&
       angles[ANG_RSHOULDERWN] < 70 &&
       positions[LEFTHAND_UPDOWN] == DOWN &&
       positions[RIGHTHAND_UPDOWN] == UP))
       return 2;
   else if ((140 < angles[ANG_LELBOW] &&
       150 < angles[ANG_RELBOW] &&
       (80 < angles[ANG_LSHOULDER] && angles[ANG_LSHOULDER] < 135) &&
       (80 < angles[ANG_RSHOULDER] && angles[ANG_RSHOULDER] < 145) &&
       positions[LEFTHAND_UPDOWN] == UP &&
       positions[RIGHTHAND_UPDOWN] == DOWN) ||
       (150 < angles[ANG_RELBOW] &&
       (80 < angles[ANG_RSHOULDER] && angles[ANG_RSHOULDER] < 145) &&
       angles[ANG_LSHOULDERWN] < 70 &&
       positions[RIGHTHAND_UPDOWN] == DOWN &&
       positions[LEFTHAND_UPDOWN] == UP))
       return -2;
   else if ((150 < angles[ANG_LELBOW] &&
       150 < angles[ANG_RELBOW] &&
       (145 < angles[ANG_LSHOULDER] && angles[ANG_LSHOULDER] < 165) &&
       (135 < angles[ANG_RSHOULDER] && angles[ANG_RSHOULDER] < 165) &&
       positions[LEFTHAND_UPDOWN] == UP &&
       positions[RIGHTHAND_UPDOWN] == DOWN) ||
       ((145 < angles[ANG_LSHOULDERW] && angles[ANG_LSHOULDERW] < 165) &&
       (135 < angles[ANG_RSHOULDERW] && angles[ANG_RSHOULDERW] < 165) &&
       positions[LEFTHAND_UPDOWN] == UP &&
       positions[RIGHTHAND_UPDOWN] == DOWN))
       return 3;
   else if ((150 < angles[ANG_LELBOW] &&
       150 < angles[ANG_RELBOW] &&
       (135 < angles[ANG_LSHOULDER] && angles[ANG_LSHOULDER] < 165) &&
       (145 < angles[ANG_RSHOULDER] && angles[ANG_RSHOULDER] < 165) &&
       positions[LEFTHAND_UPDOWN] == DOWN &&
       positions[RIGHTHAND_UPDOWN] == UP) ||
       ((135 < angles[ANG_LSHOULDERW] && angles[ANG_LSHOULDERW] < 165) &&
       (145 < angles[ANG_RSHOULDERW] && angles[ANG_RSHOULDERW] < 165) &&
       positions[LEFTHAND_UPDOWN] == DOWN &&
       positions[RIGHTHAND_UPDOWN] == UP))
       return 4;
   else if ((150 < angles[ANG_RELBOW] &&
       (80 < angles[ANG_LSHOULDER] && angles[ANG_LSHOULDER] < 145) &&
       165 < angles[ANG_RSHOULDER] &&
       positions[LEFTHAND_UPDOWN] == UP) ||
       (160 < angles[ANG_RSHOULDERW] &&
       positions[LEFTHAND_UPDOWN] == UP &&
       positions[LEFTHAND_LR] == RIGHT))
       return 6;
   else if ((150 < angles[ANG_LELBOW] &&
       150 < angles[ANG_RELBOW] &&
       165 < angles[ANG_LSHOULDER] &&
       (80 < angles[ANG_RSHOULDER] && angles[ANG_RSHOULDER] < 130) &&
       positions[RIGHTHAND_UPDOWN] == UP) ||
       (160 < angles[ANG_LSHOULDERW] &&
       angles[ANG_RSHOULDERWN] < 70 &&
       positions[RIGHTHAND_UPDOWN] == UP))
       return 7;
   else if ((150 < angles[ANG_LELBOW] &&
       150 < angles[ANG_RELBOW] &&
       (80 < angles[ANG_LSHOULDER] && angles[ANG_LSHOULDER] < 135) &&
       170 < angles[ANG_RSHOULDER] &&
       positions[LEFTHAND_UPDOWN] == DOWN) ||
       (150 < angles[ANG_LELBOW] &&
       (80 < angles[ANG_LSHOULDER] && angles[ANG_LSHOULDER] < 135) &&
       170 < angles[ANG_RSHOULDERW] &&
       positions[LEFTHAND_UPDOWN] == DOWN))
       return 8;
   else if ((100 < angles[ANG_LELBOW] &&
       150 < angles[ANG_RELBOW] &&
       angles[ANG_LSHOULDER] < 90 &&
       165 < angles[ANG_RSHOULDER] &&
       positions[LEFTHAND_UPDOWN] == DOWN) ||
       (angles[ANG_LSHOULDERW] < 100 &&
       165 < angles[ANG_RSHOULDERW] &&
       positions[LEFTHAND_UPDOWN] == DOWN &&
       positions[LEFTHAND_LR] == RIGHT))
       return 9;
   else if ((150 < angles[ANG_LELBOW] &&
       150 < angles[ANG_RELBOW] &&
       (130 < angles[ANG_LSHOULDER] && angles[ANG_LSHOULDER] < 165) &&
       (130 < angles[ANG_RSHOULDER] && angles[ANG_RSHOULDER] < 165) &&
       positions[LEFTHAND_UPDOWN] == UP &&
       positions[RIGHTHAND_UPDOWN] == UP) ||
       ((130 < angles[ANG_LSHOULDERW] && angles[ANG_LSHOULDERW] < 165) &&
       (130 < angles[ANG_RSHOULDERW] && angles[ANG_RSHOULDERW] < 165) &&
       positions[LEFTHAND_UPDOWN] == UP &&
       positions[RIGHTHAND_UPDOWN] == UP))
       return 10;
   else if ((150 < angles[ANG_LELBOW] &&
       angles[ANG_RELBOW] < 150 &&
       (130 < angles[ANG_LSHOULDER] && angles[ANG_LSHOULDER] < 160) &&
       (80 < angles[ANG_RSHOULDER] && angles[ANG_RSHOULDER] < 120) &&
       positions[LEFTHAND_UPDOWN] == UP &&
       positions[RIGHTHAND_UPDOWN] == UP &&
       positions[RIGHTHAND_LR] == LEFT) ||
       ((130 < angles[ANG_LSHOULDERW] && angles[ANG_LSHOULDERW] < 160) &&
       (80 < angles[ANG_RSHOULDERW] && angles[ANG_RSHOULDERW] < 120) &&
       positions[LEFTHAND_UPDOWN] == UP &&
       positions[RIGHTHAND_UPDOWN] == UP &&
       positions[RIGHTHAND_LR] == LEFT))
       return -11;
   else if ((angles[ANG_LELBOW] < 150 &&
       150 < angles[ANG_RELBOW] &&
       (60 < angles[ANG_LSHOULDER] && angles[ANG_LSHOULDER] < 120) &&
       (130 < angles[ANG_RSHOULDER] && angles[ANG_RSHOULDER] < 160) &&
       positions[LEFTHAND_UPDOWN] == DOWN &&
       positions[RIGHTHAND_UPDOWN] == DOWN &&
       positions[LEFTHAND_LR] == RIGHT) ||
       ((60 < angles[ANG_LSHOULDERW] && angles[ANG_LSHOULDERW] < 120) &&
       (130 < angles[ANG_RSHOULDERW] && angles[ANG_RSHOULDERW] < 160) &&
       positions[LEFTHAND_UPDOWN] == DOWN &&
       positions[RIGHTHAND_UPDOWN] == DOWN &&
       positions[LEFTHAND_LR] == RIGHT))
       return 11;
   else if ((150 < angles[ANG_LELBOW] &&
       150 < angles[ANG_RELBOW] &&
       (145 < angles[ANG_LSHOULDER] && angles[ANG_LSHOULDER] < 170) &&
       (80 < angles[ANG_RSHOULDER] && angles[ANG_RSHOULDER] < 120) &&
       positions[LEFTHAND_UPDOWN] == UP &&
       positions[RIGHTHAND_UPDOWN] == DOWN) ||
       (150 < angles[ANG_RELBOW] &&
       (145 < angles[ANG_LSHOULDERW] && angles[ANG_LSHOULDERW] < 170) &&
       (80 < angles[ANG_RSHOULDER] && angles[ANG_RSHOULDER] < 120) &&
       positions[LEFTHAND_UPDOWN] == UP &&
       positions[RIGHTHAND_UPDOWN] == DOWN))
       return 13;
   else if ((150 < angles[ANG_LELBOW] &&
       150 < angles[ANG_RELBOW] &&
       (80 < angles[ANG_LSHOULDER] && angles[ANG_LSHOULDER] < 120) &&
       (145 < angles[ANG_RSHOULDER] && angles[ANG_RSHOULDER] < 170) &&
       positions[LEFTHAND_UPDOWN] == DOWN &&
       positions[RIGHTHAND_UPDOWN] == UP) ||
       (150 < angles[ANG_LELBOW] &&
       (80 < angles[ANG_LSHOULDER] && angles[ANG_LSHOULDER] < 120) &&
       (145 < angles[ANG_RSHOULDERW] && angles[ANG_RSHOULDERW] < 170) &&
       positions[LEFTHAND_UPDOWN] == DOWN &&
       positions[RIGHTHAND_UPDOWN] == UP))
       return 14;
   else if ((angles[ANG_LELBOW] < 120 && angles[ANG_LELBOW] != -1) &&
       (angles[ANG_RELBOW] < 120 && angles[ANG_RELBOW] != -1) &&
       positions[LEFTHAND_UPDOWN] == UP &&
       positions[RIGHTHAND_UPDOWN] == UP)
       return 5;
   else if ((140 < angles[ANG_LELBOW] &&
       140 < angles[ANG_RELBOW] &&
       (80 < angles[ANG_LSHOULDER] && angles[ANG_LSHOULDER] < 135) &&
       (80 < angles[ANG_RSHOULDER] && angles[ANG_RSHOULDER] < 135) &&
       positions[LEFTHAND_UPDOWN] == UP &&
       positions[RIGHTHAND_UPDOWN] == UP) ||
       (angles[ANG_LSHOULDERWN] < 70 &&
       angles[ANG_RSHOULDERWN] < 70 &&
       positions[LEFTHAND_UPDOWN] == UP &&
       positions[RIGHTHAND_UPDOWN] == UP))
       return 12;
   else
       return -1;
}

function judge_kana(text, genkakus) {
   strGen = genkakus.toString();
   if (strGen == [1, 10, 1])
       return '';
  
   if (strGen == [13]){
       if (text.length == 0){
           return text;
       }

       switch (text.slice(-1)){
           case 'か': return text.slice(0, -1) + 'が';
           case 'き': return text.slice(0, -1) + 'ぎ';
           case 'く': return text.slice(0, -1) + 'ぐ';
           case 'け': return text.slice(0, -1) + 'げ';
           case 'こ': return text.slice(0, -1) + 'ご';
           case 'さ': return text.slice(0, -1) + 'ざ';
           case 'し': return text.slice(0, -1) + 'じ';
           case 'す': return text.slice(0, -1) + 'ず';
           case 'た': return text.slice(0, -1) + 'だ';
           case 'ち': return text.slice(0, -1) + 'ぢ';
           case 'つ': return text.slice(0, -1) + 'づ';
           case 'て': return text.slice(0, -1) + 'で';
           case 'と': return text.slice(0, -1) + 'ど';
           case 'は': return text.slice(0, -1) + 'ば';
           case 'ひ': return text.slice(0, -1) + 'び';
           case 'ふ': return text.slice(0, -1) + 'ぶ';
           case 'へ': return text.slice(0, -1) + 'べ';
           case 'ほ': return text.slice(0, -1) + 'ぼ';
           default: return text;
       }
   }

   if (strGen == [14]){
       if (text.length == 0){
           return text;
       }

       switch(text.slice(-1)){
           case 'は': return text.slice(0, -1) + 'ぱ';
           case 'ひ': return text.slice(0, -1) + 'ぴ';
           case 'ふ': return text.slice(0, -1) + 'ぷ';
           case 'へ': return text.slice(0, -1) + 'ぺ';
           case 'ほ': return text.slice(0, -1) + 'ぽ';
           default: return text;
       }
   }

   if (strGen == [9, 3])
       return text + 'あ';
   else if (strGen == [3, 2])
       return text + 'い';
   else if (strGen == [6, 9])
       return text + 'う';
   else if (strGen == [1, -2, 1])
       return text + 'え';
   else if (strGen == [1, 2, 3])
       return text + 'お';
   else if (strGen == [8, 3])
       return text + 'か';
   else if (strGen == [6, 2])
       return text + 'き';
   else if (strGen == [-11, 11])
       return text + 'く';
   else if (strGen == [7, 3])
       return text + 'け';
   else if (strGen == [8, 1])
       return text + 'こ';
   else if (strGen == [1, 12])
       return text + 'さ';
   else if (strGen == [5, 7])
       return text + 'し';
   else if (strGen == [1, 2, 5])
       return text + 'す';
   else if (strGen == [9, 7])
       return text + 'せ';
   else if (strGen == [5, 3])
       return text + 'そ';
   else if (strGen == [-11, 11, 5])
       return text + 'た';
   else if (strGen == [7, -2])
       return text + 'ち';
   else if (strGen == [12, 3])
       return text + 'つ';
   else if (strGen == [6, 3])
       return text + 'て';
   else if (strGen == [2, 5])
       return text + 'と';
   else if (strGen == [1, 3])
       return text + 'な';
   else if (strGen == [6])
       return text + 'に';
   else if (strGen == [9, 4])
       return text + 'ぬ';
   else if (strGen == [9, 2, 1])
       return text + 'ね';
   else if (strGen == [3])
       return text + 'の';
   else if (strGen == [10])
       return text + 'は';
   else if (strGen == [1, 7])
       return text + 'ひ';
   else if (strGen == [9])
       return text + 'ふ';
   else if (strGen == [4])
       return text + 'へ';
   else if (strGen == [1, 2, 10])
       return text + 'ほ';
   else if (strGen == [9, 5])
       return text + 'ま';
   else if (strGen == [6, 1])
       return text + 'み';
   else if (strGen == [7, 5])
       return text + 'む';
   else if (strGen == [3, 5])
       return text + 'め';
   else if (strGen == [6, 7])
       return text + 'も';
   else if (strGen == [8, 4])
       return text + 'や';
   else if (strGen == [9, 1])
       return text + 'ゆ';
   else if (strGen == [8, 6])
       return text + 'よ';
   else if (strGen == [5, 9])
       return text + 'ら';
   else if (strGen == [12])
       return text + 'り';
   else if (strGen == [3, 7])
       return text + 'る';
   else if (strGen == [7])
       return text + 'れ';
   else if (strGen == [7, 8])
       return text + 'ろ';
   else if (strGen == [1, 9])
       return text + 'を';
   else if (strGen == [2, 9])
       return text + 'わ';
   else if (strGen == [5, 1])
       return text + 'ん';
   else
       return text;
       
}