const imageScaleFactor = 0.2;
const outputStride = 16;
const flipHorizontal = false;
const stats = new Stats();
const contentWidth = 800;
const contentHeight = 600;
const ballNum = 2;
const colors = ["red","blue","green"];
const fontLayout = "bold 50px Arial";

let balls = [];
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

	if (timeLimit == 0) {
	    ctx.font = fontLayout;
	    ctx.fillStyle = "red";
	    ctx.fillText("TIME UP", 300, 300);
	    ctx.fill();
	} else {
            poses.forEach(({ s, keypoints }) => {
		drawBP(keypoints[0],keypoints[1],ctx);
            });
	}

	ctx.font = fontLayout;
	ctx.fillStyle = "red";
	ctx.fillText(score, 70, 70);
	ctx.fill();
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