document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root');
  
  // Create HTML structure
  root.innerHTML = `
    <div class="flex flex-col items-center justify-center w-full p-8 bg-gray-100 min-h-screen">
      <div class="mb-6 flex flex-wrap gap-4 items-center justify-center">
        <button id="toggle-tracking" class="px-4 py-2 rounded font-medium bg-blue-500 hover:bg-blue-600 text-white">
          Start Tracking
        </button>
        
        <button id="toggle-method" class="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded font-medium">
          Switch to Head Tracking
        </button>
        
        <button id="calibrate" class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-medium">
          Calibrate Position
        </button>
        
        <div class="flex items-center gap-2 ml-4">
          <span class="text-gray-700">Strength:</span>
          <input 
            type="range" 
            id="parallax-strength" 
            min="40" 
            max="200" 
            value="140" 
            class="w-32"
          />
          <span class="text-gray-700 w-8" id="strength-value">140</span>
        </div>
        
        <div class="ml-4 text-gray-700">
          Status: <span id="status" class="font-medium">Not tracking</span>
        </div>
      </div>
      
      <div id="window-container" class="relative w-full max-w-4xl h-96 overflow-hidden border-8 border-amber-800 rounded shadow-2xl">
        <!-- Window frame -->
        <div class="absolute inset-0 pointer-events-none z-10">
          <div class="absolute left-1/2 top-0 bottom-0 w-4 bg-amber-800 transform -translate-x-1/2"></div>
          <div class="absolute top-1/2 left-0 right-0 h-4 bg-amber-800 transform -translate-y-1/2"></div>
          <div class="absolute inset-0 border-2 border-white opacity-20"></div>
          <div class="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 pointer-events-none"></div>
        </div>
        
        <!-- Parallax layers -->
        <div id="layers-container" class="absolute inset-0 overflow-hidden">
          <!-- Layers will be added here programmatically -->
        </div>
        
        <!-- Glass reflection overlay -->
        <div class="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 pointer-events-none z-5"></div>
      </div>
      
      <div class="mt-4 hidden" id="debug-container">
        <div class="flex gap-4">
          <div class="relative">
            <video 
              id="webcam"
              class="w-64 h-48 bg-black rounded"
              autoplay 
              playsinline 
              muted
            ></video>
            <div class="absolute top-2 left-2 text-white text-xs bg-black/50 px-2 py-1 rounded">
              Webcam Feed
            </div>
          </div>
          
          <div class="relative">
            <canvas 
              id="canvas"
              class="w-64 h-48 bg-black rounded"
            ></canvas>
            <div class="absolute top-2 left-2 text-white text-xs bg-black/50 px-2 py-1 rounded">
              Face Detection
            </div>
          </div>
        </div>
      </div>
      
      <div class="mt-6 max-w-2xl text-center text-gray-600">
        <p class="mb-2">Move your mouse to experience the parallax effect that simulates looking through a window.</p>
        <p>Click "Start Tracking" to activate tracking, then move your cursor around to see the parallax effect.</p>
      </div>
    </div>
  `;
  
  // Add SVG layers to container
  const layersContainer = document.getElementById('layers-container');
  const layerDepths = [0.05, 0.2, 0.5, 0.7, 1.2];
  const layerSvgs = [
    createSkyLayer(),
    createMountainsLayer(),
    createHillsLayer(),
    createTreesLayer(),
    createForegroundLayer()
  ];
  
  layerSvgs.forEach((svg, index) => {
    const layerDiv = document.createElement('div');
    layerDiv.className = 'absolute inset-0';
    layerDiv.setAttribute('data-depth', layerDepths[index]);
    layerDiv.innerHTML = svg;
    layersContainer.appendChild(layerDiv);
  });
  
  // Get DOM elements
  const toggleButton = document.getElementById('toggle-tracking');
  const methodButton = document.getElementById('toggle-method');
  const calibrateButton = document.getElementById('calibrate');
  const statusText = document.getElementById('status');
  const windowContainer = document.getElementById('window-container');
  const debugContainer = document.getElementById('debug-container');
  const video = document.getElementById('webcam');
  const canvas = document.getElementById('canvas');
  const strengthSlider = document.getElementById('parallax-strength');
  const strengthValue = document.getElementById('strength-value');
  
  // Initialize variables
  let tracking = false;
  let usingMouse = true;
  let position = { x: 0, y: 0 };
  let neutralPosition = { x: 0, y: 0 };
  let lastPosition = { x: 0, y: 0 };
  let animationFrame = null;
  let stream = null;
  let parallaxStrength = 140;
  const smoothingFactor = 0.25;
  
  // Update strength display when slider changes
  strengthSlider.addEventListener('input', function() {
    parallaxStrength = parseInt(this.value);
    strengthValue.textContent = parallaxStrength;
    if (tracking) {
      updateParallax();
    }
  });
  
  // Load face-api models
  async function loadModels() {
    try {
      statusText.textContent = 'Loading face detection models...';
      await faceapi.nets.tinyFaceDetector.load('./models');
      statusText.textContent = 'Face detection models loaded';
      return true;
    } catch (err) {
      console.error('Error loading face detection models:', err);
      statusText.textContent = 'Failed to load models. Using mouse fallback.';
      return false;
    }
  }
  
  // Start webcam access
  async function startWebcam() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user' 
        } 
      });
      
      video.srcObject = stream;
      return true;
    } catch (err) {
      console.error('Error starting webcam:', err);
      statusText.textContent = 'Webcam error. Using mouse fallback.';
      return false;
    }
  }
  
  // Face detection function
  async function detectFace() {
    if (!tracking || usingMouse) return;
    
    const context = canvas.getContext('2d');
    
    // Wait until video is ready
    if (video.readyState !== 4) {
      animationFrame = requestAnimationFrame(detectFace);
      return;
    }
    
    // Match canvas size to video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video to canvas for detection
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    try {
      // Detect faces
      const detections = await faceapi.detectSingleFace(
        canvas,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 128 })
      );
      
      if (detections) {
        // Get center of face
        const centerX = detections.box.x + detections.box.width / 2;
        const centerY = detections.box.y + detections.box.height / 2;
        
        // Normalize coordinates (-1 to 1)
        const normalizedX = (centerX / canvas.width - 0.5) * 2;
        const normalizedY = (centerY / canvas.height - 0.5) * 2;
        
        // Smooth position
        const smoothedX = lastPosition.x + (normalizedX - lastPosition.x) * smoothingFactor;
        const smoothedY = lastPosition.y + (normalizedY - lastPosition.y) * smoothingFactor;
        
        lastPosition = { x: smoothedX, y: smoothedY };
        position = { x: smoothedX, y: smoothedY };
        
        // Update layer positions
        updateParallax();
      }
    } catch (error) {
      console.error('Error in face detection:', error);
    }
    
    // Continue detection loop
    animationFrame = requestAnimationFrame(detectFace);
  }
  
  // Handle mouse movement for tracking
  function handleMouseMove(e) {
    if (!tracking || !usingMouse) return;
    
    const rect = windowContainer.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Normalize to -1 to 1 range
    const normalizedX = (e.clientX - centerX) / (window.innerWidth / 3);
    const normalizedY = (e.clientY - centerY) / (window.innerHeight / 3);
    
    // Apply smoothing
    const smoothedX = lastPosition.x + (normalizedX - lastPosition.x) * smoothingFactor;
    const smoothedY = lastPosition.y + (normalizedY - lastPosition.y) * smoothingFactor;
    
    lastPosition = { x: smoothedX, y: smoothedY };
    position = { x: smoothedX, y: smoothedY };
    
    // Update layer positions
    updateParallax();
  }
  
  // Update parallax effect
  function updateParallax() {
    const layers = document.querySelectorAll('#layers-container > div');
    
    layers.forEach(layer => {
      const depth = parseFloat(layer.getAttribute('data-depth'));
      const offsetX = position.x - neutralPosition.x;
      const offsetY = position.y - neutralPosition.y;
      
      // Apply depth factor and invert for realistic parallax
      // For X: When you move right, objects should appear to move left (positive)
      // For Y: When you move up, objects should appear to move down (negative)
      const translateX = offsetX * parallaxStrength * depth;  // No negative sign for X (correct)
      const translateY = -offsetY * parallaxStrength * depth; // Negative sign for Y (keep inverted)
      
      layer.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
      layer.style.transition = 'transform 0.1s ease-out';
    });
  }
  
  // Toggle tracking
  async function toggleTracking() {
    if (tracking) {
      // Stop tracking
      tracking = false;
      toggleButton.textContent = 'Start Tracking';
      toggleButton.classList.replace('bg-red-500', 'bg-blue-500');
      toggleButton.classList.replace('hover:bg-red-600', 'hover:bg-blue-600');
      statusText.textContent = 'Not tracking';
      
      // Stop animation frame
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
      
      // Stop webcam if active
      if (stream && !usingMouse) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        video.srcObject = null;
      }
      
      // Hide debug view
      debugContainer.classList.add('hidden');
    } else {
      // Start tracking
      tracking = true;
      toggleButton.textContent = 'Stop Tracking';
      toggleButton.classList.replace('bg-blue-500', 'bg-red-500');
      toggleButton.classList.replace('hover:bg-blue-600', 'hover:bg-red-600');
      
      if (usingMouse) {
        statusText.textContent = 'Tracking with mouse';
        window.addEventListener('mousemove', handleMouseMove);
      } else {
        // Load models if not already loaded
        await loadModels();
        
        // Start webcam
        const webcamStarted = await startWebcam();
        
        if (webcamStarted) {
          statusText.textContent = 'Head tracking active';
          debugContainer.classList.remove('hidden');
          detectFace();
        } else {
          // Fall back to mouse tracking
          usingMouse = true;
          methodButton.textContent = 'Switch to Head Tracking';
          statusText.textContent = 'Tracking with mouse';
          window.addEventListener('mousemove', handleMouseMove);
        }
      }
    }
  }
  
  // Toggle between mouse and head tracking
  function toggleMethod() {
    if (tracking) return; // Can't change while tracking
    
    usingMouse = !usingMouse;
    
    if (usingMouse) {
      methodButton.textContent = 'Switch to Head Tracking';
      statusText.textContent = 'Ready for mouse tracking';
      debugContainer.classList.add('hidden');
    } else {
      methodButton.textContent = 'Switch to Mouse Tracking';
      statusText.textContent = 'Ready for head tracking';
    }
  }
  
  // Calibrate neutral position
  function calibrate() {
    neutralPosition = { ...position };
    statusText.textContent = 'Calibrated';
    setTimeout(() => {
      statusText.textContent = tracking ? (usingMouse ? 'Tracking with mouse' : 'Head tracking active') : 'Not tracking';
    }, 1500);
  }
  
  // Event listeners
  toggleButton.addEventListener('click', toggleTracking);
  methodButton.addEventListener('click', toggleMethod);
  calibrateButton.addEventListener('click', calibrate);
  
  // SVG generation functions
  function createSkyLayer() {
    return `
      <svg width="100%" height="100%" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#8cb3ff" />
            <stop offset="100%" stop-color="#d9e7ff" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#skyGradient)" />
        <circle cx="650" cy="120" r="60" fill="#ffd633" />
        <path d="M100,200 Q200,150 300,200 Q400,250 500,200 Q600,150 700,200" fill="#ffffff" opacity="0.6" />
        <path d="M50,280 Q150,230 250,280 Q350,330 450,280 Q550,230 650,280" fill="#ffffff" opacity="0.5" />
        <path d="M200,140 Q300,90 400,140 Q500,190 600,140" fill="#ffffff" opacity="0.7" />
      </svg>
    `;
  }
  
  function createMountainsLayer() {
    return `
      <svg width="100%" height="100%" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
        <path d="M-100,600 L200,200 L500,500 L800,150 L900,600 Z" fill="#7d9ac7" />
        <path d="M-100,600 L100,350 L200,450 L400,280 L600,450 L800,300 L900,600 Z" fill="#6b86b3" />
      </svg>
    `;
  }
  
  function createHillsLayer() {
    return `
      <svg width="100%" height="100%" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
        <path d="M-100,600 L100,400 L300,500 L500,350 L700,480 L900,380 L900,600 Z" fill="#567a46" />
        <path d="M-100,600 L50,500 L200,550 L400,450 L600,550 L800,500 L900,600 Z" fill="#4a6c3b" />
      </svg>
    `;
  }
  
  function createTreesLayer() {
    return `
      <svg width="100%" height="100%" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
        <!-- Several tree shapes -->
        <g opacity="0.9">
          <rect x="50" y="450" width="15" height="40" fill="#5d4037" />
          <path d="M40,450 L75,450 L57.5,410 Z" fill="#2e7d32" />
          <path d="M42,420 L73,420 L57.5,380 Z" fill="#2e7d32" />
        </g>
        
        <g opacity="0.9">
          <rect x="150" y="430" width="15" height="50" fill="#5d4037" />
          <path d="M140,430 L175,430 L157.5,390 Z" fill="#388e3c" />
          <path d="M142,400 L173,400 L157.5,360 Z" fill="#388e3c" />
        </g>
        
        <g opacity="0.9">
          <rect x="250" y="450" width="12" height="35" fill="#5d4037" />
          <path d="M240,450 L272,450 L256,415 Z" fill="#2e7d32" />
          <path d="M242,425 L270,425 L256,390 Z" fill="#2e7d32" />
        </g>
        
        <g opacity="0.9">
          <rect x="350" y="440" width="14" height="45" fill="#5d4037" />
          <path d="M340,440 L374,440 L357,400 Z" fill="#388e3c" />
          <path d="M342,410 L372,410 L357,370 Z" fill="#388e3c" />
        </g>
        
        <g opacity="0.9">
          <rect x="450" y="460" width="13" height="30" fill="#5d4037" />
          <path d="M440,460 L473,460 L456.5,425 Z" fill="#2e7d32" />
          <path d="M442,435 L471,435 L456.5,400 Z" fill="#2e7d32" />
        </g>
        
        <g opacity="0.9">
          <rect x="550" y="430" width="16" height="50" fill="#5d4037" />
          <path d="M540,430 L576,430 L558,390 Z" fill="#388e3c" />
          <path d="M542,400 L574,400 L558,360 Z" fill="#388e3c" />
        </g>
        
        <g opacity="0.9">
          <rect x="650" y="450" width="14" height="35" fill="#5d4037" />
          <path d="M640,450 L674,450 L657,415 Z" fill="#2e7d32" />
          <path d="M642,425 L672,425 L657,390 Z" fill="#2e7d32" />
        </g>
        
        <g opacity="0.9">
          <rect x="750" y="440" width="15" height="45" fill="#5d4037" />
          <path d="M740,440 L775,440 L757.5,400 Z" fill="#388e3c" />
          <path d="M742,410 L773,410 L757.5,370 Z" fill="#388e3c" />
        </g>
      </svg>
    `;
  }
  
  function createForegroundLayer() {
    return `
      <svg width="100%" height="100%" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
        <!-- Foreground trees -->
        <g>
          <rect x="100" y="400" width="25" height="200" fill="#5d4037" />
          <circle cx="112" cy="380" r="50" fill="#43a047" />
        </g>
        
        <g>
          <rect x="700" y="420" width="20" height="180" fill="#5d4037" />
          <circle cx="710" cy="400" r="45" fill="#43a047" />
        </g>
        
        <!-- Bushes -->
        <ellipse cx="200" cy="580" rx="70" ry="40" fill="#388e3c" />
        <ellipse cx="400" cy="590" rx="80" ry="35" fill="#2e7d32" />
        <ellipse cx="600" cy="585" rx="75" ry="30" fill="#388e3c" />
        
        <!-- Grass blades -->
        <path d="M50,600 C60,570 70,585 80,600" stroke="#2e7d32" strokeWidth="2" fill="none" />
        <path d="M90,600 C100,565 110,580 120,600" stroke="#388e3c" strokeWidth="2" fill="none" />
        <path d="M140,600 C150,570 160,585 170,600" stroke="#2e7d32" strokeWidth="2" fill="none" />
        <path d="M250,600 C260,575 270,585 280,600" stroke="#388e3c" strokeWidth="2" fill="none" />
        <path d="M320,600 C330,565 340,580 350,600" stroke="#2e7d32" strokeWidth="2" fill="none" />
        <path d="M450,600 C460,570 470,585 480,600" stroke="#388e3c" strokeWidth="2" fill="none" />
        <path d="M550,600 C560,575 570,585 580,600" stroke="#2e7d32" strokeWidth="2" fill="none" />
        <path d="M650,600 C660,565 670,580 680,600" stroke="#388e3c" strokeWidth="2" fill="none" />
        <path d="M750,600 C760,570 770,585 780,600" stroke="#2e7d32" strokeWidth="2" fill="none" />
      </svg>
    `;
  }
  
  // Initialize by loading models in background
  loadModels();
});