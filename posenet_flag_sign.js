const imageScaleFactor = 0.2;
const outputStride = 16;
const flipHorizontal = false;
const stats = new Stats();
const contentWidth = 800;
const contentHeight = 600;
const colors = ["red","blue","green"];
const fontLayout = "bold 40px Arial";
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

let genkaku = -1;
let count = 0;
let seq_genkaku = [];
let curText = '';
let score = 0;
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
                    ctx.font = "bold 200px Arial";
                    ctx.fillStyle = "blue";
                    ctx.fillText(genkaku, 200, 200);
                    ctx.fill();
                }
            }

            //test
            let angles = getAngles(keypoints);

            // draw strings
            ctx.font = "bold 24px Arial";
            //ctx.font = fontLayout;
            ctx.fillStyle = "red";
            //ctx.fillText(curText, 40, 40);
            /*ctx.fillText('left elbow: ' + keypoints[LEFTELBOW].position.y.toFixed(1) + ', ' + keypoints[LEFTELBOW].position.x.toFixed(1), 40, 40);
            ctx.fill();
            ctx.fillText('right elbow: ' + keypoints[RIGHTELBOW].position.y.toFixed(1) + ', ' + keypoints[RIGHTELBOW].position.x.toFixed(1), 40, 80);
            ctx.fill();
            ctx.fillText('left wrist: ' + keypoints[LEFTWRIST].position.y.toFixed(1) + ', ' + keypoints[LEFTWRIST].position.x.toFixed(1), 40, 120);
            ctx.fill();
            ctx.fillText('right wrist: ' + keypoints[RIGHTWRIST].position.y.toFixed(1) + ', ' + keypoints[RIGHTWRIST].position.x.toFixed(1), 40, 160);
            ctx.fill();*/
            ctx.fillText('left elbow: ' + angles[0].toFixed(1), 40, 40);
            ctx.fill();
            ctx.fillText('right elbow: ' + angles[1].toFixed(1), 40, 80);
            ctx.fill();
            ctx.fillText('left wrist: ' + angles[2].toFixed(1), 40, 120);
            ctx.fill();
            ctx.fillText('right wrist: ' + angles[3].toFixed(1), 40, 160);
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

   //x1 = keypoints[LEFTWRIST].position.x;
   //y1 = keypoints[LEFTWRIST].position.y;
   //x0 = keypoints[LEFTELBOW].position.x;
   //y0 = keypoints[LEFTELBOW].position.y;
   //x2 = keypoints[LEFTSHOULDER].position.x;
   //y2 = keypoints[LEFTSHOULDER].position.y;

   //deg = calculateInternalAngle(x0, x1, x2, y0, y1, y2);
   deg = calculateInternalAngle(keypoints, LEFTELBOW, LEFTWRIST, LEFTSHOULDER, 0.5);
   angles.push(deg);

   //右ひじの角度
   deg = calculateInternalAngle(keypoints, RIGHTELBOW, RIGHTWRIST, RIGHTSHOULDER, 0.5);
   angles.push(deg);
  
   // 左肩
   deg = calculateInternalAngle(keypoints, LEFTSHOULDER, RIGHTSHOULDER, LEFTELBOW, 0.5);
   angles.push(deg);
  
   // 右肩
   deg = calculateInternalAngle(keypoints, RIGHTSHOULDER, LEFTSHOULDER, RIGHTELBOW, 0.5);
   angles.push(deg);

   return angles;
}

//function calculateInternalAngle(x0, x1, x2, y0, y1, y2) {
function calculateInternalAngle(keypoints, point0, point1, point2, minConfidence) {

    if(keypoints[point0].score < minConfidence || keypoints[point1].score < minConfidence || keypoints[point2].score < minConfidence){
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

const UP = 1;
const DOWN = 2;

function get_positions(keypoints) {
    positions = [];
    if((keypoints[LEFTELBOW].score > 0.5) && (keypoints[LEFTELBOW].position.y < keypoints[LEFTSHOULDER].position.y) ||
    (keypoints[LEFTWRIST].score > 0.5) && (keypoints[LEFTWRIST].position.y < keypoints[LEFTSHOULDER].position.y)){
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
    if ((150 < angles[0]) && (150 < angles[1]) && (80 < angles[2] < 130) && (80 < angles[3] < 130) && (positions[0] == DOWN) && (positions[1] == DOWN))
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
    else if (angles[0] < 120 && angles[1] < 120 && positions[0] == UP && positions[1] == UP)
        return 5;
    else if (150 < angles[1] && (80 < angles[2] && angles[2] < 145) && 165 < angles[3] && positions[0] == UP)
        return 6;
    else if (150 < angles[0] && 150 < angles[1] && 165 < angles[2] && (80 < angles[3] && angles[3] < 130) && positions[1] == UP)
        return 7;
    else if (150 < angles[0] && 150 < angles[1] && (80 < angles[2] && angles[2] < 135) && 165 < angles[3] && positions[0] == DOWN)
        return 8;
    else if (120 < angles[0] && 150 < angles[1] && angles[2] < 80 && 165 < angles[3] && positions[0] == DOWN)
        return 9;
    else if (150 < angles[0] && 150 < angles[1] && (130 < angles[2] && angles[2] < 165) && (130 < angles[3] && angles[3] < 165) && positions[0] == UP && positions[1] == UP)
        return 10;
    else if (150 < angles[0] && angles[1] < 150 && (130 < angles[2] && angles[2] < 160) && (80 < angles[3] && angles[3] < 120) && positions[0] == UP && positions[1] == UP)
        return -11;
    else if (angles[0] < 150 && 150 < angles[1] && (60 < angles[2] && angles[2] < 120) && (130 < angles[3] && angles[3] < 160) && positions[0] == DOWN && positions[1] == DOWN)
        return 11;
    else if (150 < angles[0] && 150 < angles[1] && (80 < angles[2] && angles[2] < 135) && (80 < angles[3] && angles[3] < 135) && positions[0] == UP && positions[1] == UP)
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
/*
    switch(strGen){
        case [9, 3]: return text + 'あ';
        case [3, 2]: return text + 'い';
        case [6, 9]: return text + 'う';
        case [1, -2, 1]: return text + 'え';
        case [1, 2, 3]: return text + 'お';
        case [8, 3]: return text + 'か';
        case [6, 2]: return text + 'き';
        case [-11, 11]: return text + 'く';
        case [7, 3]: return text + 'け';
        case [8, 1]: return text + 'こ';
        case [1, 12]: return text + 'さ';
        case [5, 7]: return text + 'し';
        case [1, 2, 5]: return text + 'す';
        case [9, 7]: return text + 'せ';
        case [5, 3]: return text + 'そ';
        case [-11, 11, 5]: return text + 'た';
        case [7, -2]: return text + 'ち';
        case [12, 3]: return text + 'つ';
        case [6, 3]: return text + 'て';
        case [2, 5]: return text + 'と';
        case [1, 3]: return text + 'な';
        case [6]: return text + 'に';
        case [9, 4]: return text + 'ぬ';
        case [9, 2, 1]: return text + 'ね';
        case [3]: return text + 'の';
        case [10]: return text + 'は';
        case [1, 7]: return text + 'ひ';
        case [9]: return text + 'ふ';
        case [4]: return text + 'へ';
        case [1, 2, 10]: return text + 'ほ';
        case [9, 5]: return text + 'ま';
        case [6, 1]: return text + 'み';
        case [7, 5]: return text + 'む';
        case [3, 5]: return text + 'め';
        case [6, 7]: return text + 'も';
        case [8, 4]: return text + 'や';
        case [9, 1]: return text + 'ゆ';
        case [8, 6]: return text + 'よ';
        case [5, 9]: return text + 'ら';
        case [12]: return text + 'り';
        case [3, 7]: return text + 'る';
        case [7]: return text + 'れ';
        case [7, 8]: return text + 'ろ';
        case [1, 9]: return text + 'を';
        case [2, 9]: return text + 'わ';
        case [5, 1]: return text + 'ん';
        default: return text;
    }
    */

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