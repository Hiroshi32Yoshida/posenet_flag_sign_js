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

let genkaku = -1;
let count = 0;
let seq_genkaku = [];
let curText = '';
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

            result = judge_genkaku(keypoints);
            if(result != -1){
                if(genkaku == result){
                    count++;
                    if(count == 3){
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

                if(count > 2){
                    ctx.font = "bold 100px Arial";
                    ctx.fillStyle = "blue";
                    ctx.fillText(genkaku, 100, 100);
                    ctx.fill();
                }
            }
            //angles = getAngles(keypoints);

            ctx.font = fontLayout;
            ctx.fillStyle = "red";
            ctx.fillText(curText, 70, 70);
            //ctx.fillText('left elbow: ' + angles[0].toFixed(1), 70, 70);
            //ctx.fillText('right elbow: ' + angles[1].toFixed(1), 70, 80);
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

const UP = 0;
const DOWN = 1;

function get_positions(keypoints) {
    positions = [];
    if(keypoints[LEFTEFBOW].y < keypoints[LEFTSHOULDER].y)
        positions.push(UP);  // up
    else
        positions.push(DOWN);  // down

    if(keypoints[RIGHTELBOW].y < keypoints[RIGHTSHOULDER].y)
        positions.push(UP);  // up
    else
        positions.push(DOWN);  // down

    return positions
}

function judge_genkaku(keypoints){
    angles = getAngles(keypoints);
    positions = get_positions(keypoints);
    // left elbow - right elbow - left shoulder - right shoulder
    if ((150 < angles[0]) && (150 < angles[1]) && (80 < angles[2] < 130) && (80 < angles[3] < 130) && (positions[0] == DOWN) && (positions[1] == DOWN))
        return 0
    else if (160 < angles[0] && 160 < angles[1] && 160 < angles[2] && 160 < angles[3])
        return 1
    else if (150 < angles[0] && 140 < angles[1] && 80 < angles[2] < 145 && 80 < angles[3] < 135 && positions[0] == DOWN && positions[1] == UP)
        return 2
    else if (140 < angles[0] && 150 < angles[1] && 80 < angles[2] < 135 && 80 < angles[3] < 145 && positions[0] == UP && positions[1] == DOWN)
        return -2
    else if (150 < angles[0] && 150 < angles[1] && 145 < angles[2] < 165 && 135 < angles[3] < 165 && positions[0] == UP && positions[1] == DOWN)
        return 3
    else if (150 < angles[0] && 150 < angles[1] && 135 < angles[2] < 165 && 145 < angles[3] < 165 && positions[0] == DOWN && positions[1] == UP)
        return 4
    else if (angles[0] < 120 && angles[1] < 120 && positions[0] == UP && positions[1] == UP)
        return 5
    else if (150 < angles[1] && 80 < angles[2] < 145 && 165 < angles[3] && positions[0] == UP)
        return 6
    else if (150 < angles[0] && 150 < angles[1] && 165 < angles[2] && 80 < angles[3] < 130 && positions[1] == UP)
        return 7
    else if (150 < angles[0] && 150 < angles[1] && 80 < angles[2] < 135 && 165 < angles[3] && positions[0] == DOWN)
        return 8
    else if (120 < angles[0] && 150 < angles[1] && angles[2] < 80 && 165 < angles[3] && positions[0] == DOWN)
        return 9
    else if (150 < angles[0] && 150 < angles[1] && 130 < angles[2] < 165 && 130 < angles[3] < 165 && positions[0] == UP && positions[1] == UP)
        return 10
    else if (150 < angles[0] && angles[1] < 150 && 130 < angles[2] < 160 && 80 < angles[3] < 120 && positions[0] == UP && positions[1] == UP)
        return -11
    else if (angles[0] < 150 && 150 < angles[1] && 60 < angles[2] < 120 && 130 < angles[3] < 160 && positions[0] == DOWN && positions[1] == DOWN)
        return 11
    else if (150 < angles[0] && 150 < angles[1] && 80 < angles[2] < 135 && 80 < angles[3] < 135 && positions[0] == UP && positions[1] == UP)
        return 12
    else if (150 < angles[0] && 150 < angles[1] && 145 < angles[2] < 165 && 80 < angles[3] < 120 && positions[0] == UP && positions[1] == DOWN)
        return 13
    else if (150 < angles[0] && 150 < angles[1] && 80 < angles[2] < 120 && 145 < angles[3] < 165 && positions[0] == DOWN && positions[1] == UP)
        return 14
    else
        return -1
}

function judge_kana(text, genkakus) {
    kana_text = '';
    if (genkakus == [1, 10, 1])
        return '';
   
    if (genkakus == [13]){
        if (text.length == 0)
            return text;
       
        if (text.slice(-1) == 'か')
            return text.slice(0, -1) + 'が';
        else if (text.slice(-1) == 'き')
            return text.slice(0, -1) + 'ぎ';
        else if (text.slice(-1) == 'く')
            return text.slice(0, -1) + 'ぐ';
        else if (text.slice(-1) == 'け')
            return text.slice(0, -1) + 'げ';
        else if (text.slice(-1) == 'こ')
            return text.slice(0, -1) + 'ご';
        else if (text.slice(-1) == 'さ')
            return text.slice(0, -1) + 'ざ';
        else if (text.slice(-1) == 'し')
            return text.slice(0, -1) + 'じ';
        else if (text.slice(-1) == 'す')
            return text.slice(0, -1) + 'ず';
        else if (text.slice(-1) == 'た')
            return text.slice(0, -1) + 'だ';
        else if (text.slice(-1) == 'ち')
            return text.slice(0, -1) + 'ぢ';
        else if (text.slice(-1) == 'つ')
            return text.slice(0, -1) + 'づ';
        else if (text.slice(-1) == 'て')
            return text.slice(0, -1) + 'で';
        else if (text.slice(-1) == 'と')
            return text.slice(0, -1) + 'ど';
        else if (text.slice(-1) == 'は')
            return text.slice(0, -1) + 'ば';
        else if (text.slice(-1) == 'ひ')
            return text.slice(0, -1) + 'び';
        else if (text.slice(-1) == 'ふ')
            return text.slice(0, -1) + 'ぶ';
        else if (text.slice(-1) == 'へ')
            return text.slice(0, -1) + 'べ';
        else if (text.slice(-1) == 'ほ')
            return text.slice(0, -1) + 'ぼ';
        else
            return;
    }

    if (genkakus == [14]){
        if (text.length == 0)
            return text;
       
        if (text.slice(-1) == 'は')
            return text.slice(0, -1) + 'ぱ';
        else if (text.slice(-1) == 'ひ')
            return text.slice(0, -1) + 'ぴ';
        else if (text.slice(-1) == 'ふ')
            return text.slice(0, -1) + 'ぷ';
        else if (text.slice(-1) == 'へ')
            return text.slice(0, -1) + 'ぺ';
        else if (text.slice(-1) == 'ほ')
            return text.slice(0, -1) + 'ぽ';
        else
            return;
    }

    if (genkakus == [9, 3])
        return text + 'あ';
    else if (genkakus == [3, 2])
        return text + 'い';
    else if (genkakus == [6, 9])
        return text + 'う';
    else if (genkakus == [1, -2, 1])
        return text + 'え';
    else if (genkakus == [1, 2, 3])
        return text + 'お';
    else if (genkakus == [8, 3])
        return text + 'か';
    else if (genkakus == [6, 2])
        return text + 'き';
    else if (genkakus == [-11, 11])
        return text + 'く';
    else if (genkakus == [7, 3])
        return text + 'け';
    else if (genkakus == [8, 1])
        return text + 'こ';
    else if (genkakus == [1, 12])
        return text + 'さ';
    else if (genkakus == [5, 7])
        return text + 'し';
    else if (genkakus == [1, 2, 5])
        return text + 'す';
    else if (genkakus == [9, 7])
        return text + 'せ';
    else if (genkakus == [5, 3])
        return text + 'そ';
    else if (genkakus == [-11, 11, 5])
        return text + 'た';
    else if (genkakus == [7, -2])
        return text + 'ち';
    else if (genkakus == [12, 3])
        return text + 'つ';
    else if (genkakus == [6, 3])
        return text + 'て';
    else if (genkakus == [2, 5])
        return text + 'と';
    else if (genkakus == [1, 3])
        return text + 'な';
    else if (genkakus == [6])
        return text + 'に';
    else if (genkakus == [9, 4])
        return text + 'ぬ';
    else if (genkakus == [9, 2, 1])
        return text + 'ね';
    else if (genkakus == [3])
        return text + 'の';
    else if (genkakus == [10])
        return text + 'は';
    else if (genkakus == [1, 7])
        return text + 'ひ';
    else if (genkakus == [9])
        return text + 'ふ';
    else if (genkakus == [4])
        return text + 'へ';
    else if (genkakus == [1, 2, 10])
        return text + 'ほ';
    else if (genkakus == [9, 5])
        return text + 'ま';
    else if (genkakus == [6, 1])
        return text + 'み';
    else if (genkakus == [7, 5])
        return text + 'む';
    else if (genkakus == [3, 5])
        return text + 'め';
    else if (genkakus == [6, 7])
        return text + 'も';
    else if (genkakus == [8, 4])
        return text + 'や';
    else if (genkakus == [9, 1])
        return text + 'ゆ';
    else if (genkakus == [8, 6])
        return text + 'よ';
    else if (genkakus == [5, 9])
        return text + 'ら';
    else if (genkakus == [12])
        return text + 'り';
    else if (genkakus == [3, 7])
        return text + 'る';
    else if (genkakus == [7])
        return text + 'れ';
    else if (genkakus == [7, 8])
        return text + 'ろ';
    else if (genkakus == [1, 9])
        return text + 'を';
    else if (genkakus == [5, 1])
        return text + 'ん';
    else
        return text;
}