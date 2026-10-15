const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];
let activeZone = 0; 

// Desktop glow canvas (larger)
const glowCanvasDesktop = document.createElement('canvas');
glowCanvasDesktop.width = 30;
glowCanvasDesktop.height = 30;
const gCtxD = glowCanvasDesktop.getContext('2d');
gCtxD.shadowBlur = 5;
gCtxD.shadowColor = '#dc2626';
gCtxD.fillStyle = '#dc2626';
gCtxD.beginPath();
gCtxD.arc(15, 15, 3, 0, Math.PI * 2);
gCtxD.fill();

// Mobile glow canvas (smaller and tighter)
const glowCanvasMobile = document.createElement('canvas');
glowCanvasMobile.width = 16;
glowCanvasMobile.height = 16;
const gCtxM = glowCanvasMobile.getContext('2d');
gCtxM.shadowBlur = 3;
gCtxM.shadowColor = '#dc2626';
gCtxM.fillStyle = '#dc2626';
gCtxM.beginPath();
gCtxM.arc(8, 8, 1.5, 0, Math.PI * 2);
gCtxM.fill();

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}

async function getShapeCoordinates(source, centerX, centerY) {
    const offscreen = document.createElement('canvas');
    const offCtx = offscreen.getContext('2d');
    offscreen.width = width;
    offscreen.height = height;
    
    let gap = width < 768 ? 5 : 10;

    // CHECK: Is the source an image file?
    if (typeof source === 'string' && (source.endsWith('.png') || source.endsWith('.jpg') || source.endsWith('.jpeg'))) {
        const img = new Image();
        img.crossOrigin = "Anonymous"; // Prevents security errors on GitHub Pages
        img.src = source;
        
        // Wait for the image to load before reading pixels
        await new Promise(resolve => {
            img.onload = resolve;
            img.onerror = () => {
                console.error("Failed to load image:", source);
                resolve(); // Resolve anyway so the code doesn't crash
            };
        });

        // Scale the image to fit nicely in the center (max 50% of screen width/height)
        const maxSize = Math.min(width * 0.5, height * 0.5);
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const drawX = centerX - (drawWidth / 2);
        const drawY = centerY - (drawHeight / 2);

        offCtx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

    } else {
        // FALLBACK: It's text, use the existing text logic
        let fontSize = width < 768 ? '20vw' : '12vw';
        offCtx.font = `bold ${fontSize} Arial`;
        offCtx.fillStyle = 'white';
        offCtx.textAlign = 'center';
        offCtx.textBaseline = 'middle';

        const words = String(source).split(' ');
        const lineHeight = height * 0.15;
        const startY = centerY - ((words.length - 1) * lineHeight) / 2;

        if (width < 768) {
            words.forEach((word, index) => {
                offCtx.fillText(word, centerX, startY + (index * lineHeight));
            });
        } else {
            offCtx.fillText(String(source), centerX, centerY);
        }
    }

    // Read the pixels (works for both drawn text and drawn images!)
    const imageData = offCtx.getImageData(0, 0, width, height).data;
    const coordinates = [];

    for (let y = 0; y < height; y += gap) {
        for (let x = 0; x < width; x += gap) {
            const alpha = imageData[(y * width + x) * 4 + 3];
            if (alpha > 128) {
                coordinates.push({ x, y });
            }
        }
    }
    
    // Fallback circle if something goes wrong
    if (coordinates.length === 0) {
        for (let i = 0; i < 400; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 150;
            coordinates.push({ x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius });
        }
    }
    
    return coordinates;
}

class Particle {
    constructor(targetX1, targetY1, targetX2, targetY2) {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        
        this.targetX1 = targetX1;
        this.targetY1 = targetY1;
        this.targetX2 = targetX2;
        this.targetY2 = targetY2;
        
        this.vx = (Math.random() - 0.5) * 4; 
        this.vy = (Math.random() - 0.5) * 4;
        
        this.currentVx = 0;
        this.currentVy = 0;
        
        this.phase = Math.random() * Math.PI *2;

        this.bloomIntensity = 0; 
        
        this.size = Math.random() * 1.5 + 1.0;
    }

    update(zone) {
        let targetX, targetY;
        let targetVx, targetVy;

        if (zone === 1) {
            targetX = this.targetX1;
            targetY = this.targetY1;
        } else if (zone === 2) {
            targetX = this.targetX2;
            targetY = this.targetY2;
        }

        if (zone !== 0 && targetX !== undefined) {

            const time = Date.now() * 0.001;
            const floatRadius = 5; 

            const floatX = Math.sin(time + this.phase) * floatRadius *Math.random();
            const floatY = Math.cos(time + this.phase) * floatRadius *Math.random();

            targetX = targetX + floatX
            targetY = targetY + floatY

            targetVx = (targetX - this.x) * 0.08;
            targetVy = (targetY - this.y) * 0.08;
        } else {
            targetVx = this.vx;
            targetVy = this.vy;
        }

        // Smoothly blend velocity
        this.currentVx += (targetVx - this.currentVx) * 0.2;
        this.currentVy += (targetVy - this.currentVy) * 0.2;

        this.x += this.currentVx;
        this.y += this.currentVy;

        // Bounce logic
        if (this.x < 0) {
            this.x = 0; this.currentVx *= -1; this.vx *= -1;
        } else if (this.x > width) {
            this.x = width; this.currentVx *= -1; this.vx *= -1;
        }
        if (this.y < 0) {
            this.y = 0; this.currentVy *= -1; this.vy *= -1;
        } else if (this.y > height) {
            this.y = height; this.currentVy *= -1; this.vy *= -1;
        }

        const targetBloom = zone !== 0 ? 1.0 : 0.0;
        this.bloomIntensity += (targetBloom - this.bloomIntensity) * 0.1;
    }

    draw(zone) {
        ctx.fillStyle = 'rgba(220, 38, 38, 0.4)'; 
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();

        if (this.bloomIntensity > 0.01) {
            ctx.globalAlpha = this.bloomIntensity; // Fades from 0.0 to 1.0 smoothly
            if (width < 768) {
                ctx.drawImage(glowCanvasMobile, this.x - 8, this.y - 8);
            } else {
                ctx.drawImage(glowCanvasDesktop, this.x - 15, this.y - 15);
            }
            ctx.globalAlpha = 1.0;
        }
    }
}

async function init() {
    particles = [];
    
    const text1 = "VOTE JAMIL"; 
    const text2 = "Logo.png"; 
    
    const targets1 = await getShapeCoordinates(text1, width / 2, height / 2);
    const targets2 = await getShapeCoordinates(text2, width / 2, height / 2);

    const maxTargets = Math.max(targets1.length, targets2.length);

    for (let i = 0; i < maxTargets; i++) {
        const t1 = targets1[i % targets1.length];
        const t2 = targets2[i % targets2.length];
        particles.push(new Particle(t1.x, t1.y, t2.x, t2.y));
    }
}

window.addEventListener('scroll', () => {
    const zone1 = document.getElementById('trigger-zone-1');
    const zone2 = document.getElementById('trigger-zone-2');
    
    if (!zone1 || !zone2) return;

    const centerScreen = window.innerHeight / 2;
    const triggerDistance1 = 150; 
    const triggerDistance2 = 150; 

    const rect1 = zone1.getBoundingClientRect();
    const rect2 = zone2.getBoundingClientRect();

    const dist1 = Math.abs((rect1.top + rect1.height / 2) - centerScreen);
    const dist2 = Math.abs((rect2.top + rect2.height / 2) - centerScreen);

    if (dist1 < triggerDistance1) {
        activeZone = 1;
    } else if (dist2 < triggerDistance2) {
        activeZone = 2;
    } else {
        activeZone = 0; 
    }
});

function animate() {
    ctx.clearRect(0, 0, width, height);
    
    particles.forEach(p => {
        p.update(activeZone);
        p.draw(activeZone);
    });

    requestAnimationFrame(animate);
}

// Initialize safely
document.fonts.ready.then(() => {
    resize();
    init();
    animate();
});

window.addEventListener('resize', () => {
    resize();
    init();
});