const imageScaleFactor = 0.2;
const outputStride = 16;
const flipHorizontal = false;
const stats = new Stats();
const contentWidth = 800;
const contentHeight = 600;
const colors = ["red","blue","green"];
const fontLayout = "bold 50px Arial";
const color = 'aqua';

let score = 0;
let timeLimit = 200;
let printLimit = timeLimit / 10;
let bpface = new Image();
let navScale = 1
bpface.src = "bp_face.png"
bindPage();

async function bindPage() {
    const net = await posenet.load();
    let video;
    try {
        video = await loadVideo();
    } catch(e) {
        console.error(e);
        return;
    }
    detectPoseInRealTime(video, net);
}

async function loadVideo() {
    const video = await setupCamera();
    video.play();
    return video;
}

async function setupCamera() {
    const video = document.getElementById('video');
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
            'audio': false,
            'video': true});
        video.srcObject = stream;

        return new Promise(resolve => {
            video.onloadedmetadata = () => {
                resolve(video);
            };
        });
    } else {
        const errorMessage = "This browser does not support video capture, or this device does not have a camera";
        alert(errorMessage);
        return Promise.reject(errorMessage);
    }
}

function detectPoseInRealTime(video, net) {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const flipHorizontal = true; // since images are being fed from a webcam

    async function poseDetectionFrame() {
        stats.begin();
        let poses = [];
        const pose = await net.estimateSinglePose(video, imageScaleFactor, flipHorizontal, outputStride);
        poses.push(pose);

        ctx.clearRect(0, 0, contentWidth,contentHeight);

        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-contentWidth, 0);
        ctx.drawImage(video, 0, 0, contentWidth, contentHeight);
        ctx.restore();

        if (timeLimit % 10 == 0) {
            printLimit = timeLimit / 10;
        }
        ctx.font = fontLayout;
        ctx.fillStyle = "blue";
        ctx.fillText(printLimit, 670, 70);
        ctx.fill();
        
        let deg;

        poses.forEach(({ s, keypoints }) => {
	        drawBP(keypoints[0],keypoints[1],ctx);
            drawKeypoints(keypoints, 0.5, ctx);
            //drawSkeleton(keypoints, 0.5, ctx);
            deg = calculate_angles(keypoints);

            ctx.font = fontLayout;
            ctx.fillStyle = "red";
            ctx.fillText(deg, 70, 70);
            ctx.fill();
        });

        timeLimit -= 1;
        if(timeLimit <= 0){
            timeLimit = 0;
        }

        stats.end();

        requestAnimationFrame(poseDetectionFrame);
    }
    poseDetectionFrame();
}

function drawBP(nose, leye, ctx){
    navScale = (leye.position.x - nose.position.x - 50) / 20;
    if (navScale < 1) navScale = 1;
    let nw = bpface.width * navScale;
    let nh = bpface.height * navScale;
    ctx.drawImage(bpface,nose.position.x - nh / 2 , nose.position.y - nh / 1.5, nw, nh);
}

function drawPoint(ctx, y, x, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
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

function calculate_angles(keypoints) {
   var angles = [];

   x1 = keypoints[9].position.x;
   y1 = keypoints[9].position.y;
   x0 = keypoints[7].position.x;
   y0 = keypoints[7].position.y;
   x2 = keypoints[5].position.x;
   y2 = keypoints[5].position.y;

   deg = inner_Calc(x0, x1, x2, y0, y1, y2);
   angles.push(deg);
}

const partNames = [
    'nose', 'leftEye', 'rightEye', 'leftEar', 'rightEar', 'leftShoulder',
    'rightShoulder', 'leftElbow', 'rightElbow', 'leftWrist', 'rightWrist',
    'leftHip', 'rightHip', 'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle'
  ];

function inner_Calc(x0, x1, x2, y0, y1, y2) {
    var a = {x:x1-x0,y:y1-y0};
    var b = {x:x2-x0,y:y2-y0};
    
    //内積
    var dot = a.x * b.x + a.y * b.y;
    
    //絶対値
    var absA = Math.sqrt(a.x*a.x + a.y*a.y);
    var absB = Math.sqrt(b.x*b.x + b.y*b.y);
    
    //dot = |a||b|cosθという公式より
    var cosTheta = dot / (absA*absB);
    
    //すでにベクトルがノーマライズされてたら dotのみでいける
    
    //cosθの逆関数
    var theta = Math.acos(cosTheta);

    return theta;
}
