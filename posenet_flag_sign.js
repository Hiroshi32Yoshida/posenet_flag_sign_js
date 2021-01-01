const imageScaleFactor = 0.2;
const outputStride = 16;
const flipHorizontal = false;
const stats = new Stats();
const contentWidth = 800;
const contentHeight = 600;
const colors = ["red","blue","green"];
const fontLayout = "bold 50px Arial";
const color = 'aqua';

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
    const flipHorizontal = false; // since images are being fed from a webcam

    async function poseDetectionFrame() {
        stats.begin();
        let poses = [];
        const pose = await net.estimateSinglePose(video, imageScaleFactor, flipHorizontal, outputStride);
        poses.push(pose);

        ctx.clearRect(0, 0, contentWidth,contentHeight);

        ctx.save();
        ctx.scale(-1, 1);
        //ctx.translate(-contentWidth, 0);
        ctx.drawImage(video, 0, 0, contentWidth, contentHeight);
        ctx.restore();

        let deg;

        poses.forEach(({ s, keypoints }) => {
	        //drawBP(keypoints[0],keypoints[1],ctx);
            drawKeypoints(keypoints, 0.5, ctx);
            //drawSkeleton(keypoints, 0.5, ctx);
            angles = getAngles(keypoints);

            ctx.font = fontLayout;
            ctx.fillStyle = "red";
            ctx.fillText(angles[0].toFixed(1), 70, 70);
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

function getAngles(keypoints) {
   var angles = [];

   x1 = keypoints[LEFTWRIST].position.x;
   y1 = keypoints[LEFTWRIST].position.y;
   x0 = keypoints[LEFTELBOW].position.x;
   y0 = keypoints[LEFTELBOW].position.y;
   x2 = keypoints[LEFTSHOULDER].position.x;
   y2 = keypoints[LEFTSHOULDER].position.y;

   deg = calculateInternalAngle(x0, x1, x2, y0, y1, y2);
   angles.push(deg);

   //右ひじの角度
   x1 = keypoints[RIGHTWRIST].position.x;
   y1 = keypoints[RIGHTWRIST].position.y;
   x0 = keypoints[RIGHTELBOW].position.x;
   y0 = keypoints[RIGHTELBOW].position.y;
   x2 = keypoints[RIGHTSHOULDER].position.x;
   y2 = keypoints[RIGHTSHOULDER].position.y;
  
   deg = calculateInternalAngle(x0, x1, x2, y0, y1, y2);
   angles.push(deg);
  
   // 左肩
   x1 = keypoints[RIGHTSHOULDER].position.x;
   y1 = keypoints[RIGHTSHOULDER].position.y;
   x0 = keypoints[LEFTSHOULDER].position.x;
   y0 = keypoints[LEFTSHOULDER].position.y;
   x2 = keypoints[LEFTELBOW].position.x;
   y2 = keypoints[LEFTELBOW].position.y;
  
   deg = calculateInternalAngle(x0, x1, x2, y0, y1, y2);
   angles.push(deg);
  
   // 右肩
   x1 = keypoints[LEFTSHOULDER].position.x;
   y1 = keypoints[LEFTSHOULDER].position.y;
   x0 = keypoints[RIGHTSHOULDER].position.x;
   y0 = keypoints[RIGHTSHOULDER].position.y;
   x2 = keypoints[RIGHTELBOW].position.x;
   y2 = keypoints[RIGHTELBOW].position.y;
  
   deg = calculateInternalAngle(x0, x1, x2, y0, y1, y2);
   angles.push(deg);

   return angles;
}

function calculateInternalAngle(x0, x1, x2, y0, y1, y2) {
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
    var theta = Math.acos(cosTheta) * 180 / Math.PI;

    return theta;
}
