// Game state
let currentRoom = { x: 1, y: 2 }; // Start in foyer
let spriteColor = '';
let spritePosition = { x: 400, y: 400 };
let currentTyping = '';
let isWalking = false;
let sessionActive = true;
let sessionEndTime = null;
let currentFloor = 1;

// User management
let currentUser = {
    id: null,
    username: '',
    color: ''
};
let otherUsers = [];
let selectedColor = null;

// Presence management
let presenceInterval = null;
let roomUpdateInterval = null;

// Movement speed and grid
const MOVE_SPEED = 4;
const SPRITE_SIZE = 12;

// API endpoints 
const API_BASE = window.location.origin + '/.netlify/functions';

// Room layout (3x3 grid)
const rooms = {
    '0,0': { name: 'Northwest Room', type: 'room', doors: { south: true, east: true } },
    '1,0': { name: 'Elevator', type: 'elevator', doors: { south: true, west: true, east: true } },
    '2,0': { name: 'Northeast Room', type: 'room', doors: { south: true, west: true } },
    '0,1': { name: 'West Wing', type: 'room', doors: { north: true, south: true, east: true } },
    '1,1': { name: 'Courtyard', type: 'courtyard', doors: { north: true, south: true, east: true, west: true } },
    '2,1': { name: 'East Wing', type: 'room', doors: { north: true, south: true, west: true } },
    '0,2': { name: 'Southwest Room', type: 'room', doors: { north: true, east: true } },
    '1,2': { name: 'Foyer', type: 'foyer', doors: { north: true, west: true, east: true } },
    '2,2': { name: 'Southeast Room', type: 'room', doors: { north: true, west: true } }
};

// Text storage for each room
let roomTexts = {};

// Keyboard state
let keys = {};

// Initialize room texts
Object.keys(rooms).forEach(key => {
    roomTexts[key] = [];
});

// Pastel colors for sprites
const pastelColors = [
    '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF',
    '#E6B3FF', '#FFB3E6', '#FFD1DC', '#B3E5D1', '#D1B3FF',
    '#E6CCB3', '#B3CCE6', '#FFE6B3', '#E6FFB3', '#B3FFE6',
    '#FFC3A0', '#D4A5A5', '#A0E7E5', '#B4F8C8', '#F0E68C'
];

// User setup functions
async function loadAvailableColors() {
    try {
        console.log('Loading colors from:', `${API_BASE}/get-available-colors`);
        
        const colorStatus = document.getElementById('colorStatus');
        colorStatus.textContent = 'Loading colors...';
        
        const response = await fetch(`${API_BASE}/get-available-colors`);
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Color data received:', data);
        
        const colorGrid = document.getElementById('colorGrid');
        colorGrid.innerHTML = '';
        
        // Use all available colors if API call failed
        const colorsToUse = data.availableColors || [
            '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF',
            '#E6B3FF', '#FFB3E6', '#FFD1DC', '#B3E5D1', '#D1B3FF',
            '#E6CCB3', '#B3CCE6', '#FFE6B3', '#E6FFB3', '#B3FFE6',
            '#FFC3A0', '#D4A5A5', '#A0E7E5', '#B4F8C8', '#F0E68C'
        ];
        
        colorsToUse.forEach(color => {
            const colorDiv = document.createElement('div');
            colorDiv.className = 'color-option';
            colorDiv.style.backgroundColor = color;
            colorDiv.onclick = () => selectColor(color);
            
            if (data.usedColors && data.usedColors.includes(color)) {
                colorDiv.classList.add('used');
                colorDiv.onclick = null;
            }
            
            colorGrid.appendChild(colorDiv);
        });
        
        if (data.success) {
            const availableCount = (data.availableColors || []).length;
            const usedCount = (data.usedColors || []).length;
            colorStatus.textContent = `${availableCount} colors available • ${data.totalOnline || 0} users online`;
        } else {
            colorStatus.textContent = 'Using offline colors • Functions may not be deployed yet';
        }
        
    } catch (error) {
        console.error('Error loading colors:', error);
        
        // Fallback to default colors
        const colorGrid = document.getElementById('colorGrid');
        const fallbackColors = [
            '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF',
            '#E6B3FF', '#FFB3E6', '#FFD1DC', '#B3E5D1', '#D1B3FF',
            '#E6CCB3', '#B3CCE6', '#FFE6B3', '#E6FFB3', '#B3FFE6'
        ];
        
        colorGrid.innerHTML = '';
        fallbackColors.forEach(color => {
            const colorDiv = document.createElement('div');
            colorDiv.className = 'color-option';
            colorDiv.style.backgroundColor = color;
            colorDiv.onclick = () => selectColor(color);
            colorGrid.appendChild(colorDiv);
        });
        
        const colorStatus = document.getElementById('colorStatus');
        colorStatus.textContent = `Offline mode - All colors available • Error: ${error.message}`;
        colorStatus.style.color = '#e74c3c';
    }
}

function selectColor(color) {
    // Remove previous selection
    document.querySelectorAll('.color-option.selected').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Add selection to clicked color
    event.target.classList.add('selected');
    selectedColor = color;
    
    updateEnterButton();
}

function updateEnterButton() {
    const username = document.getElementById('usernameInput').value.trim();
    const btn = document.getElementById('enterRoomsBtn');
    
    if (username.length >= 2 && selectedColor) {
        btn.disabled = false;
    } else {
        btn.disabled = true;
    }
}

async function enterRooms() {
    const username = document.getElementById('usernameInput').value.trim();
    
    if (!username || !selectedColor) {
        alert('Please enter a username and select a color');
        return;
    }
    
    // Set up user
    currentUser.id = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    currentUser.username = username;
    currentUser.color = selectedColor;
    spriteColor = selectedColor;
    
    // Update UI
    document.getElementById('currentUsername').textContent = username;
    document.getElementById('spriteColor').textContent = selectedColor;
    document.getElementById('spriteColor').style.color = selectedColor;
    
    // Hide setup modal and show game
    document.getElementById('userSetup').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'flex';
    
    // Initialize game
    initGame();
    
    // Start presence system (with fallback)
    try {
        startPresenceSystem();
    } catch (error) {
        console.warn('Starting in offline mode:', error);
        // Set default counts for offline mode
        updateUserCounts(0, 1);
    }
}

// Presence system
function startPresenceSystem() {
    // Only start if functions are available
    if (API_BASE.includes('localhost') || API_BASE.includes('.netlify.app')) {
        // Send initial presence
        updatePresence();
        
        // Send heartbeat every 30 seconds
        presenceInterval = setInterval(updatePresence, 30000);
        
        // Update room data every 10 seconds
        roomUpdateInterval = setInterval(updateRoomData, 10000);
    } else {
        console.warn('Presence system disabled - not on Netlify');
    }
    
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        leavePresence();
    });
}

async function updatePresence() {
    try {
        const response = await fetch(`${API_BASE}/user-presence`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'heartbeat',
                userId: currentUser.id,
                username: currentUser.username,
                color: currentUser.color,
                roomId: `${currentRoom.x}-${currentRoom.y}`,
                position: spritePosition
            })
        });
        
        if (!response.ok) {
            console.warn('Presence update failed:', response.status);
            return;
        }
        
        const data = await response.json();
        if (data.success) {
            updateOtherUsers(data.users);
            updateUserCounts(data.roomCount, data.totalOnline);
        }
    } catch (error) {
        console.warn('Error updating presence (offline mode):', error.message);
        // Gracefully handle offline mode
        updateUserCounts(0, 1);
    }
}

async function leavePresence() {
    try {
        await fetch(`${API_BASE}/user-presence`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'leave',
                userId: currentUser.id
            })
        });
    } catch (error) {
        console.error('Error leaving presence:', error);
    }
}

function updateOtherUsers(users) {
    // Filter out current user
    otherUsers = users.filter(user => user.userId !== currentUser.id);
    displayOtherUsers();
}

function displayOtherUsers() {
    const currentCoords = `${currentRoom.x},${currentRoom.y}`;
    const currentRoomElement = document.getElementById(`room-${currentCoords}`);
    
    // Remove existing other user sprites
    currentRoomElement.querySelectorAll('.other-sprite').forEach(el => el.remove());
    
    // Add sprites for other users in this room
    const currentRoomId = `${currentRoom.x}-${currentRoom.y}`;
    const roomUsers = otherUsers.filter(user => user.roomId === currentRoomId);
    
    roomUsers.forEach(user => {
        const sprite = document.createElement('div');
        sprite.className = 'other-sprite';
        sprite.style.backgroundColor = user.color;
        sprite.style.left = `${user.position.x}px`;
        sprite.style.top = `${user.position.y}px`;
        sprite.setAttribute('data-username', user.username);
        currentRoomElement.appendChild(sprite);
    });
}

function updateUserCounts(roomCount, totalOnline) {
    document.getElementById('roomUserCount').textContent = roomCount - 1; // Exclude self
    document.getElementById('totalOnlineCount').textContent = totalOnline;
}

async function updateRoomData() {
    try {
        await loadCurrentRoomData();
        await updatePresence(); // Also update presence
    } catch (error) {
        console.error('Error updating room data:', error);
    }
}
function initSession(days) {
    const endTime = new Date();
    endTime.setDate(endTime.getDate() + days);
    sessionEndTime = endTime;
    
    // Store session data
    const sessionData = {
        endTime: endTime.toISOString(),
        floor: currentFloor,
        startTime: new Date().toISOString()
    };
    
    // In a real implementation, this would be stored on a server
    // For demo purposes, we'll use localStorage with a session identifier
    const sessionId = 'floor_' + currentFloor + '_' + Date.now();
    localStorage.setItem('currentSession', JSON.stringify(sessionData));
    
    document.getElementById('sessionInit').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'flex';
    
    initGame();
    startSessionTimer();
}

function initCustomSession() {
    const days = parseInt(document.getElementById('customDays').value);
    if (days && days > 0 && days <= 365) {
        initSession(days);
    } else {
        alert('Please enter a valid number of days (1-365)');
    }
}

function startSessionTimer() {
    function updateTimer() {
        if (!sessionEndTime || !sessionActive) return;
        
        const now = new Date();
        const timeLeft = sessionEndTime - now;
        
        if (timeLeft <= 0) {
            // Session expired
            sessionActive = false;
            lockSession();
            return;
        }
        
        // Format time remaining
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        
        let timerText = '';
        if (days > 0) {
            timerText = `${days}d ${hours}h ${minutes}m remaining`;
        } else if (hours > 0) {
            timerText = `${hours}h ${minutes}m remaining`;
        } else {
            timerText = `${minutes}m remaining`;
        }
        
        document.getElementById('sessionTimer').textContent = timerText;
    }
    
    updateTimer();
    setInterval(updateTimer, 60000); // Update every minute
}

function lockSession() {
    const lockOverlay = document.createElement('div');
    lockOverlay.className = 'session-locked';
    lockOverlay.innerHTML = `
        <div>
            <h2>This Floor Has Been Preserved</h2>
            <p>All messages have been locked as a time capsule.</p>
            <p>A new floor is now available...</p>
            <button onclick="startNewFloor()" style="margin-top: 20px; padding: 15px 30px; font-size: 16px; background: #3498db; color: white; border: none; border-radius: 8px; cursor: pointer;">Enter New Floor</button>
        </div>
    `;
    document.getElementById('gameContainer').appendChild(lockOverlay);
}

function startNewFloor() {
    currentFloor++;
    sessionActive = true;
    roomTexts = {};
    Object.keys(rooms).forEach(key => {
        roomTexts[key] = [];
    });
    
    document.querySelector('.session-locked').remove();
    document.getElementById('floorNumber').textContent = currentFloor;
    document.getElementById('sessionInit').style.display = 'flex';
}

function initGame() {
    // Don't auto-assign sprite color anymore - wait for user selection
    // spriteColor = pastelColors[Math.floor(Math.random() * pastelColors.length)];
    
    document.getElementById('floorNumber').textContent = currentFloor;
    
    createRooms();
    createMinimap();
    updateDisplay();
    setupEventListeners();
    
    // Start game loop
    gameLoop();
}

function createRooms() {
    const mainView = document.getElementById('mainView');
    
    Object.entries(rooms).forEach(([coords, room]) => {
        const roomDiv = document.createElement('div');
        roomDiv.className = `room ${room.type}`;
        roomDiv.id = `room-${coords}`;
        
        const label = document.createElement('div');
        label.className = 'room-label';
        label.textContent = room.name;
        roomDiv.appendChild(label);
        
        // Add doors and windows
        createDoors(roomDiv, room.doors, room.type);
        
        // Add elevator controls if this is the elevator
        if (room.type === 'elevator') {
            createElevatorControls(roomDiv);
        }
        
        mainView.appendChild(roomDiv);
    });
}

function createDoors(roomDiv, doors, roomType) {
    const doorStyle = {
        position: 'absolute',
        background: '#333',
        border: '3px solid #666',
        zIndex: 20
    };
    
    if (doors.north) {
        const door = document.createElement('div');
        Object.assign(door.style, doorStyle);
        door.style.top = '20px';
        door.style.left = '350px';
        door.style.width = '100px';
        door.style.height = '8px';
        door.className = 'door north-door';
        roomDiv.appendChild(door);
        
        // Add ASCII arrow
        const label = document.createElement('div');
        label.textContent = '▲';
        label.style.position = 'absolute';
        label.style.top = '35px';
        label.style.left = '375px';
        label.style.color = 'inherit';
        label.style.fontWeight = 'bold';
        label.style.fontSize = '16px';
        label.style.zIndex = '25';
        label.style.fontFamily = 'Courier New, monospace';
        roomDiv.appendChild(label);
    }
    
    if (doors.south) {
        const door = document.createElement('div');
        Object.assign(door.style, doorStyle);
        door.style.bottom = '20px';
        door.style.left = '350px';
        door.style.width = '100px';
        door.style.height = '8px';
        door.className = 'door south-door';
        roomDiv.appendChild(door);
        
        const label = document.createElement('div');
        label.textContent = '▼';
        label.style.position = 'absolute';
        label.style.bottom = '35px';
        label.style.left = '375px';
        label.style.color = 'inherit';
        label.style.fontWeight = 'bold';
        label.style.fontSize = '16px';
        label.style.zIndex = '25';
        label.style.fontFamily = 'Courier New, monospace';
        roomDiv.appendChild(label);
    }
    
    if (doors.west) {
        const door = document.createElement('div');
        Object.assign(door.style, doorStyle);
        door.style.left = '20px';
        door.style.top = '350px';
        door.style.width = '8px';
        door.style.height = '100px';
        door.className = 'door west-door';
        roomDiv.appendChild(door);
        
        const label = document.createElement('div');
        label.textContent = '◄';
        label.style.position = 'absolute';
        label.style.top = '375px';
        label.style.left = '35px';
        label.style.color = 'inherit';
        label.style.fontWeight = 'bold';
        label.style.fontSize = '16px';
        label.style.zIndex = '25';
        label.style.fontFamily = 'Courier New, monospace';
        roomDiv.appendChild(label);
    }
    
    if (doors.east) {
        const door = document.createElement('div');
        Object.assign(door.style, doorStyle);
        door.style.right = '20px';
        door.style.top = '350px';
        door.style.width = '8px';
        door.style.height = '100px';
        door.className = 'door east-door';
        roomDiv.appendChild(door);
        
        const label = document.createElement('div');
        label.textContent = '►';
        label.style.position = 'absolute';
        label.style.top = '375px';
        label.style.right = '35px';
        label.style.color = 'inherit';
        label.style.fontWeight = 'bold';
        label.style.fontSize = '16px';
        label.style.zIndex = '25';
        label.style.fontFamily = 'Courier New, monospace';
        roomDiv.appendChild(label);
    }
    
    // Add terminal-style windows
    const allSides = ['north', 'south', 'east', 'west'];
    allSides.forEach(side => {
        if (!doors[side] && Math.random() > 0.5) {
            const window = document.createElement('div');
            window.style.position = 'absolute';
            window.style.background = '#222';
            window.style.border = '2px solid #444';
            window.style.zIndex = '15';
            
            switch(side) {
                case 'north':
                    window.style.top = '25px';
                    window.style.left = `${150 + Math.random() * 200}px`;
                    window.style.width = '60px';
                    window.style.height = '40px';
                    break;
                case 'south':
                    window.style.bottom = '25px';
                    window.style.left = `${150 + Math.random() * 200}px`;
                    window.style.width = '60px';
                    window.style.height = '40px';
                    break;
                case 'west':
                    window.style.left = '25px';
                    window.style.top = `${150 + Math.random() * 200}px`;
                    window.style.width = '40px';
                    window.style.height = '60px';
                    break;
                case 'east':
                    window.style.right = '25px';
                    window.style.top = `${150 + Math.random() * 200}px`;
                    window.style.width = '40px';
                    window.style.height = '60px';
                    break;
            }
            
            window.className = 'window';
            roomDiv.appendChild(window);
        }
    });
}

function createElevatorControls(roomDiv) {
    const elevatorPanel = document.createElement('div');
    elevatorPanel.style.position = 'absolute';
    elevatorPanel.style.right = '50px';
    elevatorPanel.style.top = '100px';
    elevatorPanel.style.background = '#2c3e50';
    elevatorPanel.style.border = '3px solid #34495e';
    elevatorPanel.style.borderRadius = '10px';
    elevatorPanel.style.padding = '20px';
    elevatorPanel.style.color = 'white';
    elevatorPanel.style.fontFamily = 'monospace';
    elevatorPanel.style.zIndex = '30';
    elevatorPanel.innerHTML = `
        <div style="text-align: center; margin-bottom: 15px; font-weight: bold;">PAST FLOORS</div>
        <div id="floorButtons"></div>
        <div style="margin-top: 15px; font-size: 12px; text-align: center;">
            Click to visit archived floors
        </div>
    `;
    
    updateFloorButtons(elevatorPanel);
    roomDiv.appendChild(elevatorPanel);
}

function updateFloorButtons(elevatorPanel) {
    const floorButtons = elevatorPanel.querySelector('#floorButtons');
    floorButtons.innerHTML = '';
    
    // Add buttons for past floors (floors < currentFloor)
    for (let floor = 1; floor < currentFloor; floor++) {
        const button = document.createElement('button');
        button.textContent = `Floor ${floor}`;
        button.style.display = 'block';
        button.style.width = '100%';
        button.style.margin = '5px 0';
        button.style.padding = '8px';
        button.style.background = '#3498db';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '4px';
        button.style.cursor = 'pointer';
        button.style.fontFamily = 'inherit';
        
        button.onclick = () => visitPastFloor(floor);
        floorButtons.appendChild(button);
    }
    
    if (currentFloor === 1) {
        floorButtons.innerHTML = '<div style="text-align: center; color: #bdc3c7; font-size: 12px;">No past floors yet</div>';
    }
}

function visitPastFloor(floorNumber) {
    // Generate the filename for the past floor
    const filename = `floor_${floorNumber}.html`;
    
    // In a real implementation, you would have pre-generated these files
    // For demo purposes, we'll show an alert
    alert(`Would open ${filename} - this would contain the preserved text from Floor ${floorNumber}`);
    
    // Real implementation would be:
    // window.open(filename, '_blank');
}

function createMinimap() {
    const minimap = document.getElementById('minimap');
    const roomSize = 85;
    const gap = 5;

    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            const coords = `${x},${y}`;
            if (rooms[coords]) {
                const roomDiv = document.createElement('div');
                roomDiv.className = `minimap-room ${rooms[coords].type}`;
                roomDiv.style.left = `${x * (roomSize + gap) + 5}px`;
                roomDiv.style.top = `${y * (roomSize + gap) + 5}px`;
                roomDiv.style.width = `${roomSize}px`;
                roomDiv.style.height = `${roomSize}px`;
                roomDiv.id = `minimap-${coords}`;
                
                // Add room name label - show first word or abbreviated name
                const nameLabel = document.createElement('div');
                nameLabel.style.position = 'absolute';
                nameLabel.style.bottom = '2px';
                nameLabel.style.left = '2px';
                nameLabel.style.fontSize = '8px';
                nameLabel.style.color = '#333';
                nameLabel.style.fontWeight = 'bold';
                nameLabel.style.textShadow = '1px 1px 1px rgba(255,255,255,0.8)';
                
                // Create abbreviated names for all rooms
                const roomName = rooms[coords].name;
                let displayName;
                if (roomName.includes('Northwest')) displayName = 'NW';
                else if (roomName.includes('Northeast')) displayName = 'NE'; 
                else if (roomName.includes('Southwest')) displayName = 'SW';
                else if (roomName.includes('Southeast')) displayName = 'SE';
                else if (roomName.includes('West Wing')) displayName = 'West';
                else if (roomName.includes('East Wing')) displayName = 'East';
                else displayName = roomName.split(' ')[0]; // First word for others
                
                nameLabel.textContent = displayName;
                roomDiv.appendChild(nameLabel);
                
                minimap.appendChild(roomDiv);
            }
        }
    }
}

function setupEventListeners() {
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        if (!sessionActive) return;
        
        // Check if user is typing in the text input
        const isTyping = document.activeElement === document.getElementById('textInput');
        
        // Handle text input
        if (isTyping) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitText();
            }
            // Don't process movement keys while typing
            return;
        }
        
        keys[e.key.toLowerCase()] = true;
        
        // Prevent default for movement keys only when not typing
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(e.key.toLowerCase())) {
            e.preventDefault();
        }
    });
    
    document.addEventListener('keyup', (e) => {
        // Only process keyup for movement when not typing
        if (document.activeElement !== document.getElementById('textInput')) {
            keys[e.key.toLowerCase()] = false;
        }
    });
    
    // Text input listeners
    const textInput = document.getElementById('textInput');
    textInput.addEventListener('input', function(e) {
        currentTyping = e.target.value;
        updateTypingPreview();
        updateCharCounter();
    });
    
    // Prevent text input from losing focus on room change
    textInput.addEventListener('blur', (e) => {
        if (isWalking) {
            setTimeout(() => textInput.focus(), 100);
        }
    });
}

function updateCharCounter() {
    const textInput = document.getElementById('textInput');
    const counter = document.getElementById('charCounter');
    const length = textInput.value.length;
    counter.textContent = `${length}/200`;
    
    if (length > 180) {
        counter.style.color = '#e74c3c';
    } else if (length > 150) {
        counter.style.color = '#f39c12';
    } else {
        counter.style.color = '#7f8c8d';
    }
}

function gameLoop() {
    if (!sessionActive) {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    handleMovement();
    requestAnimationFrame(gameLoop);
}

function handleMovement() {
    let moved = false;
    let newX = spritePosition.x;
    let newY = spritePosition.y;
    
    // Check movement keys
    if (keys['arrowup'] || keys['w']) {
        newY -= MOVE_SPEED;
        moved = true;
    }
    if (keys['arrowdown'] || keys['s']) {
        newY += MOVE_SPEED;
        moved = true;
    }
    if (keys['arrowleft'] || keys['a']) {
        newX -= MOVE_SPEED;
        moved = true;
    }
    if (keys['arrowright'] || keys['d']) {
        newX += MOVE_SPEED;
        moved = true;
    }
    
    if (moved) {
        // Room boundaries (accounting for the room borders)
        const roomBounds = {
            left: 30,
            right: 770,
            top: 30,
            bottom: 770
        };
        
        let roomChanged = false;
        let newRoom = { ...currentRoom };
        
        // Check for room transitions at boundaries
        if (newX <= roomBounds.left && currentRoom.x > 0) {
            const currentRoomData = rooms[`${currentRoom.x},${currentRoom.y}`];
            const targetRoomData = rooms[`${currentRoom.x - 1},${currentRoom.y}`];
            if (currentRoomData?.doors?.west && targetRoomData) {
                newRoom.x--;
                newX = roomBounds.right - SPRITE_SIZE - 10; // Position away from the edge
                roomChanged = true;
            }
        } else if (newX >= roomBounds.right - SPRITE_SIZE && currentRoom.x < 2) {
            const currentRoomData = rooms[`${currentRoom.x},${currentRoom.y}`];
            const targetRoomData = rooms[`${currentRoom.x + 1},${currentRoom.y}`];
            if (currentRoomData?.doors?.east && targetRoomData) {
                newRoom.x++;
                newX = roomBounds.left + 10; // Position away from the edge
                roomChanged = true;
            }
        } else if (newY <= roomBounds.top && currentRoom.y > 0) {
            const currentRoomData = rooms[`${currentRoom.x},${currentRoom.y}`];
            const targetRoomData = rooms[`${currentRoom.x},${currentRoom.y - 1}`];
            if (currentRoomData?.doors?.north && targetRoomData) {
                newRoom.y--;
                newY = roomBounds.bottom - SPRITE_SIZE - 10; // Position away from the edge
                roomChanged = true;
            }
        } else if (newY >= roomBounds.bottom - SPRITE_SIZE && currentRoom.y < 2) {
            const currentRoomData = rooms[`${currentRoom.x},${currentRoom.y}`];
            const targetRoomData = rooms[`${currentRoom.x},${currentRoom.y + 1}`];
            if (currentRoomData?.doors?.south && targetRoomData) {
                newRoom.y++;
                newY = roomBounds.top + 10; // Position away from the edge
                roomChanged = true;
            }
        }
        
        // Apply room change or constrain movement
        if (roomChanged) {
            currentRoom = newRoom;
            spritePosition.x = newX;
            spritePosition.y = newY;
            transitionToRoom();
        } else {
            // Keep sprite within current room bounds
            spritePosition.x = Math.max(roomBounds.left, Math.min(roomBounds.right - SPRITE_SIZE, newX));
            spritePosition.y = Math.max(roomBounds.top, Math.min(roomBounds.bottom - SPRITE_SIZE, newY));
        }
        
        // Add walking animation
        if (!isWalking) {
            isWalking = true;
            const sprite = document.querySelector('.sprite');
            if (sprite) {
                sprite.classList.add('walking');
                setTimeout(() => {
                    if (sprite) {
                        sprite.classList.remove('walking');
                    }
                    isWalking = false;
                }, 100);
            }
        }
        
        updateSprite();
        updateTypingPreview();
    }
}

function transitionToRoom() {
    const transition = document.getElementById('roomTransition');
    transition.classList.add('active');
    
    setTimeout(() => {
        updateDisplay();
        transition.classList.remove('active');
    }, 200);
}

function updateDisplay() {
    // Hide all rooms
    document.querySelectorAll('.room').forEach(room => {
        room.classList.remove('active');
    });

    // Show current room
    const currentCoords = `${currentRoom.x},${currentRoom.y}`;
    const currentRoomElement = document.getElementById(`room-${currentCoords}`);
    if (currentRoomElement) {
        currentRoomElement.classList.add('active');
    }

    // Update minimap
    document.querySelectorAll('.minimap-room').forEach(room => {
        room.classList.remove('current');
    });
    document.getElementById(`minimap-${currentCoords}`)?.classList.add('current');

    // Update sprite position
    updateSprite();

    // Update room name
    document.getElementById('currentRoomName').textContent = rooms[currentCoords]?.name || 'Unknown';

    // Display room texts
    displayRoomTexts();
}

function updateSprite() {
    const currentCoords = `${currentRoom.x},${currentRoom.y}`;
    const currentRoomElement = document.getElementById(`room-${currentCoords}`);
    
    // Remove existing sprite
    document.querySelectorAll('.sprite').forEach(sprite => sprite.remove());
    
    if (currentRoomElement) {
        const sprite = document.createElement('div');
        sprite.className = 'sprite';
        sprite.style.backgroundColor = spriteColor;
        sprite.style.left = `${spritePosition.x}px`;
        sprite.style.top = `${spritePosition.y}px`;
        currentRoomElement.appendChild(sprite);
    }
}

function submitText() {
    if (!sessionActive) {
        alert('This session has ended. No new text can be added.');
        return;
    }
    
    const textInput = document.getElementById('textInput');
    const text = textInput.value.trim();
    
    if (text) {
        const currentCoords = `${currentRoom.x},${currentRoom.y}`;
        const textEntry = {
            text: text,
            x: spritePosition.x,
            y: spritePosition.y - 25, // Above sprite (adjusted for smaller sprite)
            color: spriteColor,
            timestamp: Date.now(),
            author: `visitor_${Math.random().toString(36).substr(2, 9)}`
        };
        
        roomTexts[currentCoords].push(textEntry);
        textInput.value = '';
        currentTyping = '';
        
        // Move sprite slightly after placing text
        spritePosition.x += (Math.random() - 0.5) * 40;
        spritePosition.y += (Math.random() - 0.5) * 40;
        
        // Keep sprite in bounds (updated for new boundaries)
        const bounds = {
            left: 30,
            right: 770 - SPRITE_SIZE,
            top: 30,
            bottom: 770 - SPRITE_SIZE
        };
        
        spritePosition.x = Math.max(bounds.left, Math.min(bounds.right, spritePosition.x));
        spritePosition.y = Math.max(bounds.top, Math.min(bounds.bottom, spritePosition.y));
        
        updateDisplay();
        updateCharCounter();
        
        // Simulate visitor count increase (in real app, this would be server-managed)
        if (Math.random() < 0.3) {
            visitorCount++;
            document.getElementById('visitorCount').textContent = visitorCount;
        }
    }
}

function displayRoomTexts() {
    const currentCoords = `${currentRoom.x},${currentRoom.y}`;
    const currentRoomElement = document.getElementById(`room-${currentCoords}`);
    
    // Remove existing text elements
    currentRoomElement.querySelectorAll('.room-text').forEach(el => el.remove());
    
    // Add text entries for current room
    roomTexts[currentCoords].forEach((entry, index) => {
        const textElement = document.createElement('div');
        textElement.className = 'room-text';
        textElement.textContent = entry.text;
        textElement.style.left = `${entry.x}px`;
        textElement.style.top = `${entry.y}px`;
        textElement.style.borderLeftColor = entry.color;
        
        // Add slight stagger to overlapping text
        textElement.style.zIndex = 40 + index;
        
        // Add hover effect to show timestamp
        textElement.title = `Left ${formatTimestamp(entry.timestamp)}`;
        
        currentRoomElement.appendChild(textElement);
    });
}

function updateTypingPreview() {
    const currentCoords = `${currentRoom.x},${currentRoom.y}`;
    const currentRoomElement = document.getElementById(`room-${currentCoords}`);
    
    // Remove existing typing preview
    currentRoomElement.querySelectorAll('.current-typing').forEach(el => el.remove());
    
    if (currentTyping.trim() && sessionActive) {
        const typingElement = document.createElement('div');
        typingElement.className = 'current-typing';
        typingElement.textContent = currentTyping + '|';
        typingElement.style.left = `${spritePosition.x}px`;
        typingElement.style.top = `${spritePosition.y - 25}px`; // Above sprite (adjusted)
        currentRoomElement.appendChild(typingElement);
    }
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return `${Math.floor(diffMinutes / 1440)}d ago`;
}

// Demo data for initial rooms (remove in production)
function addDemoText() {
    const demoEntries = [
        { room: '1,1', text: 'Welcome to the central courtyard...', x: 200, y: 200, color: '#FFB3BA' },
        { room: '1,2', text: 'First visitor here in the foyer!', x: 150, y: 300, color: '#BAFFC9' },
        { room: '1,0', text: 'Elevator to past floors...', x: 400, y: 350, color: '#BAE1FF' },
        { room: '0,1', text: 'Quiet contemplation space', x: 300, y: 250, color: '#FFDFBA' },
        { room: '2,1', text: 'Light streams through the eastern windows', x: 250, y: 180, color: '#E6B3FF' }
    ];
    
    demoEntries.forEach(entry => {
        if (!roomTexts[entry.room]) roomTexts[entry.room] = [];
        roomTexts[entry.room].push({
            text: entry.text,
            x: entry.x,
            y: entry.y,
            color: entry.color,
            timestamp: Date.now() - Math.random() * 86400000, // Random time in last day
            author: 'demo_visitor'
        });
    });
}

// Initialize the game when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Show user setup modal initially
    document.getElementById('userSetup').style.display = 'flex';
    document.getElementById('gameContainer').style.display = 'none';
    
    // Set up username input listener
    document.getElementById('usernameInput').addEventListener('input', updateEnterButton);
    document.getElementById('usernameInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !document.getElementById('enterRoomsBtn').disabled) {
            enterRooms();
        }
    });
    
    // Load available colors
    loadAvailableColors();
    
    // Add some demo content for testing
    addDemoText();
});

// Handle page visibility for session management
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Page is hidden, save current state
        const gameState = {
            currentRoom,
            spritePosition,
            roomTexts,
            sessionEndTime: sessionEndTime ? sessionEndTime.toISOString() : null,
            currentFloor
        };
        localStorage.setItem('gameState', JSON.stringify(gameState));
    } else {
        // Page is visible, restore state if needed
        const savedState = localStorage.getItem('gameState');
        if (savedState && sessionActive) {
            const state = JSON.parse(savedState);
            currentRoom = state.currentRoom;
            spritePosition = state.spritePosition;
            roomTexts = state.roomTexts || roomTexts;
            if (state.sessionEndTime) {
                sessionEndTime = new Date(state.sessionEndTime);
            }
            currentFloor = state.currentFloor || 1;
            updateDisplay();
        }
    }
});