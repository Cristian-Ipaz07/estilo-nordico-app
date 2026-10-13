const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

let mainWindow;
let backendProcess;
let frontendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    autoHideMenuBar: true,
    show: false
  });

  mainWindow.loadURL('http://localhost:5173');

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function isPortOpen(host, port, callback) {
  const socket = new net.Socket();
  socket.setTimeout(800);
  socket.on('connect', () => {
    socket.destroy();
    callback(true);
  });
  socket.on('timeout', () => {
    socket.destroy();
    callback(false);
  });
  socket.on('error', () => {
    socket.destroy();
    callback(false);
  });
  socket.connect(port, host);
}

function startServices() {
  const backendDir = path.join(__dirname, '..', 'backend');
  const frontendDir = path.join(__dirname, '..', 'frontend');

  // Check if Backend is already active
  isPortOpen('localhost', 8000, (isOpen) => {
    if (isOpen) {
      console.log("Backend ya se encuentra activo en el puerto 8000.");
    } else {
      console.log("Iniciando Backend en:", backendDir);
      backendProcess = spawn('bash', ['-c', 'source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload'], {
        cwd: backendDir,
        stdio: 'inherit',
        detached: true
      });
    }
  });

  // Check if Frontend is already active
  isPortOpen('localhost', 5173, (isOpen) => {
    if (isOpen) {
      console.log("Frontend ya se encuentra activo en el puerto 5173.");
      createWindow();
    } else {
      console.log("Iniciando Frontend en:", frontendDir);
      frontendProcess = spawn('npm', ['run', 'dev'], {
        cwd: frontendDir,
        stdio: 'inherit',
        detached: true
      });

      console.log("Esperando que el frontend inicie en el puerto 5173...");
      checkServer('localhost', 5173, 1000, 30, () => {
        console.log("Frontend listo! Abriendo ventana...");
        createWindow();
      });
    }
  });
}

// Utility to ping a port before loading
function checkServer(host, port, timeoutMs, maxRetries, callback) {
  let retries = 0;
  
  function attempt() {
    const socket = new net.Socket();
    
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => {
      socket.destroy();
      callback();
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      retry();
    });
    
    socket.on('error', () => {
      socket.destroy();
      retry();
    });
    
    socket.connect(port, host);
  }
  
  function retry() {
    retries++;
    if (retries < maxRetries) {
      setTimeout(attempt, 500);
    } else {
      console.error(`No se pudo conectar a ${host}:${port} despues de ${maxRetries} reintentos`);
      createWindow();
    }
  }
  
  attempt();
}

app.whenReady().then(() => {
  startServices();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  console.log("Cerrando aplicacion...");
  
  if (backendProcess && backendProcess.pid) {
    try {
      process.kill(-backendProcess.pid, 'SIGKILL');
    } catch (e) {
      console.error("Error matando backend", e);
    }
  }
  
  if (frontendProcess && frontendProcess.pid) {
    try {
      process.kill(-frontendProcess.pid, 'SIGKILL');
    } catch (e) {
      console.error("Error matando frontend", e);
    }
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
