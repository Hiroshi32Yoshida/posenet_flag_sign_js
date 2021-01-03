const imageScaleFactor = 0.2;
const outputStride = 16;
const flipHorizontal = false;
const stats = new Stats();
const contentWidth = 800;
const contentHeight = 600;
const colors = ["red","blue","green"];
const fontLayout = "bold 40px sans-serif";
const color = 'aqua';
const minConfidence = 0.3;

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

let genkaku = -1;
let count = 0;
let seq_genkaku = [];
let curText = '';
let score = 0;
let bpface = new Image();
let navScale = 1
bpface.src = "bp_face.png"
bindPage();

function isAndroid() {
    return /Android/i.test(navigator.userAgent);
}
  
function isiOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}
  
function isMobile() {
    return isAndroid() || isiOS();
}

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

const mobile = isMobile();
 
async function setupCamera() {
    const video = document.getElementById('video');
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
            'audio': false,
            'video': {
                facingMode: 'user',
                width: mobile ? undefined : contentWidth,
                height: mobile ? undefined : contentHeight,
              }
            });
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
	        drawBP(keypoints[0],keypoints[1],ctx);
            drawKeypoints(keypoints, minConfidence, ctx);
            //drawSkeleton(keypoints, 0.5, ctx);

            result = judge_genkaku(keypoints);
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
                    ctx.font = "bold 200px sans-serif";
                    ctx.fillStyle = "blue";
                    ctx.fillText(genkaku, 200, 250);
                    ctx.fill();
                }
            }

            //test
            let angles = getAngles(keypoints);

            // draw strings
            ctx.font = fontLayout;
            ctx.fillStyle = "red";
            ctx.fillText(curText, 20, 40);

            ctx.font = "18px sans-serif";
            ctx.fillStyle = "lightgray";
            ctx.fillText('angle of arms and nose:' + angles[4].toFixed(1), 10, contentHeight - 95);
            ctx.fill();
            ctx.fillText('stretching arms: left: ' + getStretchingArm(keypoints, LEFTWRIST).toString() + ', right: ' + getStretchingArm(keypoints, RIGHTWRIST).toString(), 10, contentHeight - 80);
            ctx.fill();
            //ctx.fillText('left elbow: ' + angles[0].toFixed(1) + ', right elbow: ' + angles[1].toFixed(1) + ', left wrist: ' + angles[2].toFixed(1) + ', right wrist: ' + angles[3].toFixed(1), 15, contentHeight - 80);
            //ctx.fill();
            ctx.fillText('Distance from nose:', 10, contentHeight - 65)
            ctx.fill();
            ctx.fillText('left elbow: ' + getDistFromNose(keypoints, LEFTELBOW).toFixed(1) + ', right elbow: ' + getDistFromNose(keypoints, RIGHTELBOW).toFixed(1) + ', left wrist: ' + getDistFromNose(keypoints, LEFTWRIST).toFixed(1) + ', right wrist: ' + getDistFromNose(keypoints, RIGHTWRIST).toFixed(1), 15, contentHeight - 50);
            ctx.fill();
            ctx.fillText('score = left wrist: ' + keypoints[LEFTWRIST].score.toFixed(3) + ' right wrist: ' + keypoints[RIGHTWRIST].score.toFixed(3), 10, contentHeight - 35);
            ctx.fill();
            ctx.fillText('score = left elbow: ' + keypoints[LEFTELBOW].score.toFixed(3) + ' right elbow: ' + keypoints[RIGHTELBOW].score.toFixed(3), 10, contentHeight - 20);
            ctx.fill();
            ctx.fillText('score = left shoulder: ' + keypoints[LEFTSHOULDER].score.toFixed(3) + ' right shoulder: ' + keypoints[RIGHTSHOULDER].score.toFixed(3), 10, contentHeight - 5);
            ctx.fill();
        });

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
    ctx.drawImage(bpface,nose.position.x - nw / 2 , nose.position.y - nh / 1.5, nw, nh);
}

function drawPoint(ctx, y, x, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 3 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * Draw pose keypoints onto a canvas
 */
function drawKeypoints(keypoints, confidence, ctx, scale = 1) {
  for (let i = 0; i < keypoints.length; i++) {
    const keypoint = keypoints[i];

    if (keypoint.score < confidence) {
      continue;
    }

    const {y, x} = keypoint.position;
    drawPoint(ctx, y * scale, x * scale, 3, color);
  }
}

function getDistance(keypoints, point0, point1){
    if(keypoints[point0].score < minConfidence || keypoints[point1].score < minConfidence){
        return -1;
    }
    return Math.sqrt( Math.pow( keypoints[point1].position.x - keypoints[point0].position.x, 2) + Math.pow( keypoints[point1].position.y - keypoints[point0].position.y, 2));
}

function getDistFromNose(keypoints, point){
    return getDistance(keypoints, point, NOSE);
}

function getStretchingArm(keypoints, point){
    switch(point){
        case LEFTWRIST:
            if(getDistFromNose(keypoints, LEFTSHOULDER) * 2 < getDistance(keypoints, LEFTSHOULDER, LEFTWRIST)){
                return true;
            }
            return false;
        case RIGHTWRIST:
            if(getDistFromNose(keypoints, RIGHTSHOULDER) * 2 < getDistance(keypoints, RIGHTSHOULDER, RIGHTWRIST)){
                return true;
            }
            return false;
        default: return false;
    }
}

function getAngles(keypoints) {
   var angles = [];

   //
   // 両眼との角度
   // 
   // 左肘
   deg = calculateInternalAngle(keypoints, LEFTEYE, LEFTELBOW, RIGHTEYE, minConfidence);
   angles.push(deg);

   // 右肘
   deg = calculateInternalAngle(keypoints, RIGHTEYE, RIGHTELBOW, LEFTEYE, minConfidence);
   angles.push(deg);
  
   // 左手
   deg = calculateInternalAngle(keypoints, LEFTEYE, LEFTWRIST, RIGHTEYE, minConfidence);
   angles.push(deg);
  
   // 右手
   deg = calculateInternalAngle(keypoints, RIGHTEYE, RIGHTWRIST, LEFTEYE, minConfidence);
   angles.push(deg);

   // 両手と鼻
   deg = calculateInternalAngle(keypoints, NOSE, RIGHTWRIST, LEFTWRIST, minConfidence);
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

function get_positions(keypoints) {
    positions = [];
    if((keypoints[LEFTELBOW].score > minConfidence) && (keypoints[LEFTELBOW].position.y < keypoints[LEFTSHOULDER].position.y) ||
    (keypoints[LEFTWRIST].score > minConfidence) && (keypoints[LEFTWRIST].position.y < keypoints[LEFTSHOULDER].position.y)){
        positions.push(UP);  // up
    }else{
        positions.push(DOWN);  // down
    }

    if((keypoints[RIGHTELBOW].score > 0.5) && (keypoints[RIGHTELBOW].position.y < keypoints[RIGHTSHOULDER].position.y) ||
    (keypoints[RIGHTWRIST].score > 0.5) && (keypoints[RIGHTWRIST].position.y < keypoints[RIGHTSHOULDER].position.y)){
        positions.push(UP);  // up
    }else{
        positions.push(DOWN);  // down
    }

    return positions
}

function judge_genkaku(keypoints){
    angles = getAngles(keypoints);
    positions = get_positions(keypoints);
    // left elbow - right elbow - left shoulder - right shoulder
    if (150 < angles[0] && 150 < angles[1] && (80 < angles[2] && angles[2] < 130) && (80 < angles[3] && angles[3] < 130) && positions[0] == DOWN && positions[1] == DOWN)
        return 0;
    else if (160 < angles[0] && 160 < angles[1] && 160 < angles[2] && 160 < angles[3])
        return 1;
    else if (150 < angles[0] && 140 < angles[1] && (80 < angles[2] && angles[2] < 145) && (80 < angles[3] && angles[3] < 135) && positions[0] == DOWN && positions[1] == UP)
        return 2;
    else if (140 < angles[0] && 150 < angles[1] && (80 < angles[2] && angles[2] < 135) && (80 < angles[3] && angles[3] < 145) && positions[0] == UP && positions[1] == DOWN)
        return -2;
    else if (150 < angles[0] && 150 < angles[1] && (145 < angles[2] && angles[2] < 165) && (135 < angles[3] && angles[3] < 165) && positions[0] == UP && positions[1] == DOWN)
        return 3;
    else if (150 < angles[0] && 150 < angles[1] && (135 < angles[2] && angles[2] < 165) && (145 < angles[3] && angles[3] < 165) && positions[0] == DOWN && positions[1] == UP)
        return 4;
    else if ((angles[0] < 120 && angles[0] != -1) && (angles[1] < 120 && angles[1] != -1) && positions[0] == UP && positions[1] == UP)
        return 5;
    else if (150 < angles[1] && (80 < angles[2] && angles[2] < 145) && 165 < angles[3] && positions[0] == UP)
        return 6;
    else if (150 < angles[0] && 150 < angles[1] && 165 < angles[2] && (80 < angles[3] && angles[3] < 130) && positions[1] == UP)
        return 7;
    else if (150 < angles[0] && 150 < angles[1] && (80 < angles[2] && angles[2] < 135) && 165 < angles[3] && positions[0] == DOWN)
        return 8;
    else if (100 < angles[0] && 150 < angles[1] && angles[2] < 90 && 160 < angles[3] && positions[0] == DOWN)
        return 9;
    else if (150 < angles[0] && 150 < angles[1] && (130 < angles[2] && angles[2] < 165) && (130 < angles[3] && angles[3] < 165) && positions[0] == UP && positions[1] == UP)
        return 10;
    else if (150 < angles[0] && angles[1] < 150 && (130 < angles[2] && angles[2] < 160) && (80 < angles[3] && angles[3] < 120) && positions[0] == UP && positions[1] == UP)
        return -11;
    else if (angles[0] < 150 && 150 < angles[1] && (60 < angles[2] && angles[2] < 120) && (130 < angles[3] && angles[3] < 160) && positions[0] == DOWN && positions[1] == DOWN)
        return 11;
    else if (140 < angles[0] && 140 < angles[1] && (80 < angles[2] && angles[2] < 135) && (80 < angles[3] && angles[3] < 135) && positions[0] == UP && positions[1] == UP)
        return 12;
    else if (150 < angles[0] && 150 < angles[1] && (145 < angles[2] && angles[2] < 165) && (80 < angles[3] && angles[3] < 120) && positions[0] == UP && positions[1] == DOWN)
        return 13;
    else if (150 < angles[0] && 150 < angles[1] && (80 < angles[2] && angles[2] < 120) && (145 < angles[3] && angles[3] < 165) && positions[0] == DOWN && positions[1] == UP)
        return 14;
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