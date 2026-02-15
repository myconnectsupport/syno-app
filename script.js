/* ==========================================================================
   CONFIGURATIONS & CONSTANTES
   ========================================================================== */
const ASSETS_PATH = "assets/";

let selectedEquipmentId = null;
let currentZoom = 1;
let editingEquipmentId = null;
let suggestedX = null;
let suggestedY = null;
let lastSaved = null;
let hasUnsavedChanges = false;
let isSelectionMode = false;
let selectionStart = null;
let selectedConnectionId = null;
let selectedConnectionPath = null;
let isPenMode = false;
let penFirstEquipment = null;
let isMultiSelectMode = false;
let multiSelectedIds = [];
let multiSelectStart = null;
let multiDragInitialPositions = {};
let multiDragControlPoints = {}; // <--- AJOUTER CETTE LIGNE

const GRID_SIZE = 30; // Taille de la grille magnétique

/* ==========================================================================
   GESTION HISTORIQUE (UNDO / REDO)
   ========================================================================== */
const MAX_HISTORY = 50; // Nombre max d'actions mémorisées
let historyStack = [];
let historyStep = -1;

// Fonction pour sauvegarder l'état actuel
function saveState() {
    // 1. Si on est revenu en arrière, on coupe l'historique futur (le redo est perdu si on fait une nouvelle action)
    if (historyStep < historyStack.length - 1) {
        historyStack = historyStack.slice(0, historyStep + 1);
    }

    // 2. On ajoute une COPIE PROPRE des données actuelles
    // On utilise JSON pour casser les références mémoire
    const state = JSON.stringify(equipments);
    historyStack.push(state);

    // 3. Limite de mémoire
    if (historyStack.length > MAX_HISTORY) {
        historyStack.shift(); // On enlève le plus vieux
    } else {
        historyStep++;
    }

    updateUndoRedoButtons();
    // === AJOUTER CETTE LIGNE ===
    saveToBrowser(); // <--- Sauvegarde auto à chaque action !
}

function undo() {
    if (historyStep > 0) {
        historyStep--;
        restoreState();
    }
}

function redo() {
    if (historyStep < historyStack.length - 1) {
        historyStep++;
        restoreState();
    }
}

function restoreState() {
    const stateStr = historyStack[historyStep];
    if (stateStr) {
        equipments = JSON.parse(stateStr);
        // On relance le rendu
        render();
        // On sauvegarde le statut (optionnel, pour dire que c'est "modifié")
        markAsUnsaved(); 
        // Important : On désélectionne tout pour éviter les bugs d'ID fantômes
        deselectAll();
        updateUndoRedoButtons();
    }
}

function updateUndoRedoButtons() {
    const btnUndo = document.getElementById("btnUndo");
    const btnRedo = document.getElementById("btnRedo");
    
    if(!btnUndo || !btnRedo) return;

    // Gestion Undo
    if (historyStep > 0) {
        btnUndo.disabled = false;
        btnUndo.style.opacity = "1";
    } else {
        btnUndo.disabled = true;
        btnUndo.style.opacity = "0.5";
    }

    // Gestion Redo
    if (historyStep < historyStack.length - 1) {
        btnRedo.disabled = false;
        btnRedo.style.opacity = "1";
    } else {
        btnRedo.disabled = true;
        btnRedo.style.opacity = "0.5";
    }
}

// Raccourcis Clavier (Ctrl+Z / Ctrl+Y)
document.addEventListener("keydown", function(e) {
    // Si on est en train de taper du texte, on ignore
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;

    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
    }
    
    // Ctrl+Y ou Ctrl+Shift+Z pour Redo
    if (((e.ctrlKey || e.metaKey) && e.key === "y") || 
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z")) {
        e.preventDefault();
        redo();
    }
});

// NOUVEAU : Variables pour les poignées de contrôle
let isDraggingHandle = false;
let draggedHandle = null;

// NOUVEAU : Variables pour la création de liens depuis les ports
let isCreatingLink = false;
let linkStartData = null; // Stocke { id, portIndex }

const presetsByType = {
  bullet: {
    names: ["CAM1", "CAM2", "CAM3", "CAM4", "CAM5", "CAM6", "CAM7", "CAM8", "CAM9", "CAM10", "CAM11", "CAM12", "CAM13", "CAM14", "CAM15", "CAM16", "CAM17", "CAM18", "CAM19", "CAM20"],
    ips: ["172.16.0.101", "172.16.0.102", "172.16.0.103", "172.16.0.104", "172.16.0.105", "172.16.0.106", "172.16.0.107", "172.16.0.108", "172.16.0.109", "172.16.0.110", "172.16.0.111", "172.16.0.112", "172.16.0.113", "172.16.0.114", "172.16.0.115", "172.16.0.116", "172.16.0.117", "172.16.0.118", "172.16.0.119", "172.16.0.120"]
  },
  dome: {
    names: ["CAM1", "CAM2", "CAM3", "CAM4", "CAM5", "CAM6", "CAM7", "CAM8", "CAM9", "CAM10", "CAM11", "CAM12", "CAM13", "CAM14", "CAM15", "CAM16", "CAM17", "CAM18", "CAM19", "CAM20"],
    ips: ["172.16.0.101", "172.16.0.102", "172.16.0.103", "172.16.0.104", "172.16.0.105", "172.16.0.106", "172.16.0.107", "172.16.0.108", "172.16.0.109", "172.16.0.110", "172.16.0.111", "172.16.0.112", "172.16.0.113", "172.16.0.114", "172.16.0.115", "172.16.0.116", "172.16.0.117", "172.16.0.118", "172.16.0.119", "172.16.0.120"]
  },
  switch: {
    names: ["SWITCH1", "SWITCH2", "SWITCH3", "SWITCH4", "SWITCH5", "SWITCH6", "SWITCH7", "SWITCH8", "SWITCH9", "SWITCH10"],
    ips: ["172.16.0.200", "172.16.0.201", "172.16.0.202", "172.16.0.203", "172.16.0.204", "172.16.0.205", "172.16.0.206", "172.16.0.207", "172.16.0.208", "172.16.0.209"]
  },
  nvr: {
    names: ["NVR1", "NVR2", "NVR3"],
    ips: ["172.16.0.1", "172.16.0.2", "172.16.0.3"]
  },
  ampli: {
    names: ["AMPLI1", "AMPLI2", "AMPLI3", "AMPLI4", "AMPLI5"],
    ips: ["172.16.0.51", "172.16.0.52", "172.16.0.53", "172.16.0.54", "172.16.0.55"]
  },
  routeur: {
    names: ["ROUTEUR1", "ROUTEUR2"],
    ips: ["172.16.0.254", "172.16.0.253"]
  }
};

const radioData = {
  pe: { names: [], ips: [] },
  pr: { names: [], ips: [] },
  couples: []
};

// Initialisation données Radio
for (let i = 1; i <= 19; i++) {
  const peName = `PE${i}`;
  const prName = `PR${i}`;
  let peIpSuffix = i <= 9 ? 10 + i : 20 + i;
  let prIpSuffix = i <= 9 ? 20 + i : 30 + i;
  let peIp = `172.16.0.${peIpSuffix}`;
  let prIp = `172.16.0.${prIpSuffix}`;
  radioData.pe.names.push(peName);
  radioData.pe.ips.push(peIp);
  radioData.pr.names.push(prName);
  radioData.pr.ips.push(prIp);
  radioData.couples.push({
    label: `${peName} + ${prName}`,
    peName: peName,
    prName: prName,
    peIp: peIp,
    prIp: prIp
  });
}

let equipments = [
  { id: "root", type: "routeur", deviceName: "Routeur Principal", ip: "172.16.0.1", loc: "Baie de Brassage", x: 700, y: 100, parent: null }
];

/* ==========================================================================
   NOUVEAU : SYSTÈME DE PORTS (20 par équipement)
   ========================================================================== */

// Obtenir les coordonnées d'un port spécifique
function getPortPosition(equipment, portIndex) {
  const nodeWidth = 160;
  
  // CORRECTION : Récupérer la hauteur réelle du DOM au lieu d'une valeur fixe
  const nodeElement = document.getElementById(equipment.id);
  let nodeHeight = 120; // Valeur par défaut
  
  if (nodeElement) {
    // Utiliser la hauteur réelle de l'élément
    nodeHeight = nodeElement.offsetHeight;
  }
  
  // 20 ports : TOP (0-4), RIGHT (5-9), BOTTOM (10-14), LEFT (15-19)
  if (portIndex >= 0 && portIndex <= 4) {
    // TOP
    const spacing = nodeWidth / 6;
    return { x: equipment.x + spacing * (portIndex + 1), y: equipment.y };
  } else if (portIndex >= 5 && portIndex <= 9) {
    // RIGHT
    const spacing = nodeHeight / 6;
    const index = portIndex - 5;
    return { x: equipment.x + nodeWidth, y: equipment.y + spacing * (index + 1) };
  } else if (portIndex >= 10 && portIndex <= 14) {
    // BOTTOM - Utilise maintenant la hauteur réelle !
    const spacing = nodeWidth / 6;
    const index = portIndex - 10;
    return { x: equipment.x + spacing * (index + 1), y: equipment.y + nodeHeight };
  } else if (portIndex >= 15 && portIndex <= 19) {
    // LEFT
    const spacing = nodeHeight / 6;
    const index = portIndex - 15;
    return { x: equipment.x, y: equipment.y + spacing * (index + 1) };
  }
  return { x: equipment.x + nodeWidth/2, y: equipment.y + nodeHeight/2 };
}

// Trouver le premier port libre d'un équipement
function findFreePort(equipmentId, preferredSide = 'bottom') {
  const usedPorts = new Set();
  
  // Collecter tous les ports utilisés (source et target)
  equipments.forEach(eq => {
    if (eq.parent === equipmentId && eq.sourcePort !== undefined) {
      usedPorts.add(eq.sourcePort);
    }
    if (eq.id === equipmentId && eq.targetPort !== undefined) {
      usedPorts.add(eq.targetPort);
    }
  });
  
  // Définir l'ordre de préférence selon le côté
  let portRanges = [];
  if (preferredSide === 'bottom') {
    portRanges = [[10, 14], [0, 4], [5, 9], [15, 19]]; // BOTTOM, TOP, RIGHT, LEFT
  } else if (preferredSide === 'top') {
    portRanges = [[0, 4], [10, 14], [5, 9], [15, 19]];
  } else if (preferredSide === 'right') {
    portRanges = [[5, 9], [15, 19], [0, 4], [10, 14]];
  } else if (preferredSide === 'left') {
    portRanges = [[15, 19], [5, 9], [0, 4], [10, 14]];
  }
  
  // Chercher le premier port libre
  for (let range of portRanges) {
    for (let i = range[0]; i <= range[1]; i++) {
      if (!usedPorts.has(i)) {
        return i;
      }
    }
  }
  
  return 12; // Port par défaut (milieu du bas)
}

// Déterminer le côté préféré pour la connexion automatique
function determinePreferredSide(parentEquipment, childX, childY) {
  const parentCenterX = parentEquipment.x + 80;
  const parentCenterY = parentEquipment.y + 60;
  
  const dx = childX - parentCenterX;
  const dy = childY - parentCenterY;
  
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'left' : 'right';
  } else {
    return dy > 0 ? 'top' : 'bottom';
  }
}

// Trouver le port le plus proche d'une position donnée
function findClosestPort(equipment, x, y) {
  let closestPort = 0;
  let closestDistance = Infinity;
  
  for (let i = 0; i < 20; i++) {
    const portPos = getPortPosition(equipment, i);
    const distance = Math.sqrt(Math.pow(x - portPos.x, 2) + Math.pow(y - portPos.y, 2));
    
    if (distance < closestDistance) {
      closestDistance = distance;
      closestPort = i;
    }
  }
  
  return closestPort;
}

/* ==========================================================================
   GESTION DES ICÔNES (Avec Assets)
   ========================================================================== */
function getIcon(type) {
  const imageMap = {
    routeur: "routeur.jpg",
    switch: "com1.jpg",
    nvr: "nvr.jpg",
    bullet: "cam1.jpg",
    dome: "cam2.jpg",
    box: "internet.jpg",
    ecran: "pc.jpg",
    radio: "radio.jpg",
    ampli: "ampli.jpg",
    hp: "hp.jpg",
    pupitre: "pupitre.jpg"
  };
  // Construction du chemin : assets/nom_image.jpg
  const fileName = imageMap[type] || "routeur.jpg";
  return `<img src="${ASSETS_PATH}${fileName}" class="node-image">`;
}

/* ==========================================================================
   INITIALISATION & THÈME
   ========================================================================== */
function checkPass() {
  const input = document.getElementById("pass-field");
  const loader = document.getElementById("authLoader");
  const overlay = document.getElementById("auth-overlay");

  const correctCode = "3434"; // change ton code ici

  if (input.value === correctCode) {
    loader.classList.remove("hidden");

    setTimeout(() => {
      overlay.style.display = "none";
    }, 500);

  } else {
    input.value = "Code incorrect";
    input.classList.add("shake");

    setTimeout(() => {
      input.classList.remove("shake");
      input.value = "";
    }, 900);
  }
}


function toggleDarkMode() {
  const isDark = document.getElementById("darkModeSwitch").checked;
  if (isDark) {
    document.body.classList.add("dark-mode");
    document.querySelector(".dark-mode-label").textContent = "☀️";
    localStorage.setItem("darkMode", "enabled");
  } else {
    document.body.classList.remove("dark-mode");
    document.querySelector(".dark-mode-label").textContent = "🌙";
    localStorage.setItem("darkMode", "disabled");
  }
}

// Remplace ton bloc window.load actuel par celui-ci :

window.addEventListener("load", function () {
  console.log("Application Synoptique Démarrée");
  
  // 1. Gestion du Dark Mode
  const darkMode = localStorage.getItem("darkMode");
  if (darkMode === "enabled") {
    document.getElementById("darkModeSwitch").checked = true;
    toggleDarkMode();
  }

  // 2. RÉCUPÉRATION DE L'AUTO SAVE
  const savedData = localStorage.getItem("myConnectData");
  const savedName = localStorage.getItem("myConnectName");

  if (savedData && savedData !== "[]") {
      // Si on trouve des données, on les charge
      try {
          equipments = JSON.parse(savedData);
          if (savedName) document.getElementById("siteName").value = savedName;
          showToast("📂 Restauration de la dernière session");
      } catch (e) {
          console.error("Erreur lecture sauvegarde auto", e);
      }
  }

  // 3. Lancement normal
  render();
  saveState(); // Initialise l'historique
  updateZoomDisplay();
  
  setTimeout(() => {
    const wrapper = document.getElementById("workspace-wrapper");
    if(wrapper) { wrapper.scrollLeft = 0; wrapper.scrollTop = 0; }
  }, 100);
});

/* ==========================================================================
   SAUVEGARDE & PDF
   ========================================================================== */
function updateSaveStatus(saved) {
  const statusEl = document.getElementById("saveStatus");
  if (saved) {
    statusEl.className = "save-status saved";
    statusEl.innerHTML = '<span class="status-dot">🟢</span><span class="status-text">Sauvegardé</span>';
    hasUnsavedChanges = false;
    lastSaved = new Date();
  } else {
    statusEl.className = "save-status unsaved";
    statusEl.innerHTML = '<span class="status-dot">🟡</span><span class="status-text">Non sauvegardé</span>';
    hasUnsavedChanges = true;
  }
}

function markAsUnsaved() { updateSaveStatus(false); }

function saveProject() {
  const name = document.getElementById("siteName").value || "Synoptique_SansNom";
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(equipments));
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", name + ".json");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
  updateSaveStatus(true);
  showToast("💾 Projet sauvegardé !");
}

function triggerLoad() {
  document.getElementById("fileLoader").click();
}

function loadProject(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const loadedData = JSON.parse(e.target.result);
      if (Array.isArray(loadedData)) {
        equipments = loadedData;
        render();
        let fileName = file.name.replace(".json", "");
        if (fileName.includes("Synoptique_")) fileName = fileName.replace("Synoptique_", "");
        if (fileName !== "SansNom") document.getElementById("siteName").value = fileName;
        updateSaveStatus(true);
        showToast("Projet chargé avec succès ! 📂");
      } else {
        alert("Format de fichier invalide.");
      }
    } catch (err) {
      alert("Erreur lors de la lecture du fichier.");
    }
  };
  reader.readAsText(file);
  input.value = "";
}

function checkInput() {
  document.getElementById("btnDownload").classList.toggle("disabled", !document.getElementById("siteName").value);
  markAsUnsaved();
}

function downloadPDF() {
  if (!document.getElementById("siteName").value) {
    alert("Veuillez saisir un nom de site avant d'exporter");
    return;
  }
  const name = document.getElementById("siteName").value;
  deselectAll();
  const oldZoom = currentZoom;
  const wrapper = document.getElementById("workspace-wrapper");
  const container = document.getElementById("workspace-container");

  if (equipments.length === 0) {
    alert("Aucun équipement à exporter");
    return;
  }

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  equipments.forEach((eq) => {
    minX = Math.min(minX, eq.x);
    minY = Math.min(minY, eq.y);
    maxX = Math.max(maxX, eq.x + 200);
    maxY = Math.max(maxY, eq.y + 200);
  });

  const MARGIN = 50;
  minX = Math.max(0, minX - MARGIN);
  minY = Math.max(0, minY - MARGIN);
  maxX += MARGIN;
  maxY += MARGIN;

  const captureWidth = maxX - minX;
  const captureHeight = maxY - minY;

  container.style.transform = "scale(1)";
  wrapper.scrollLeft = minX;
  wrapper.scrollTop = minY;

  showToast("📄 Génération du PDF...");

  setTimeout(() => {
    const options = {
      x: minX, y: minY, width: captureWidth, height: captureHeight,
      scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#F2F2F7"
    };

    html2canvas(container, options).then((canvas) => {
      try {
        const imgWidth = canvas.width / 2;
        const imgHeight = canvas.height / 2;
        const orientation = imgWidth > imgHeight ? "landscape" : "portrait";
        const pdf = new jspdf.jsPDF({ orientation: orientation, unit: "mm", format: "a4" });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const ratio = Math.min(pageWidth / (imgWidth * 0.264583), pageHeight / (imgHeight * 0.264583));
        const pdfWidth = imgWidth * 0.264583 * ratio;
        const pdfHeight = imgHeight * 0.264583 * ratio;
        const x = (pageWidth - pdfWidth) / 2;
        const y = (pageHeight - pdfHeight) / 2;
        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        pdf.addImage(imgData, "JPEG", x, y, pdfWidth, pdfHeight);
        pdf.save(`Synoptique_${name}.pdf`);
        showToast("✅ PDF généré avec succès !");
      } catch (error) {
        alert("Erreur lors de la génération : " + error.message);
      } finally {
        container.style.transform = `scale(${oldZoom})`;
      }
    });
  }, 300);
}

/* ==========================================================================
   WORKSPACE & ZOOM
   ========================================================================== */
function updateZoomDisplay() {
  document.getElementById("zoomIndicator").textContent = Math.round(currentZoom * 100) + "%";
}

function updateZoom(delta) {
  const newZoom = currentZoom + delta;
  if (newZoom >= 0.1 && newZoom <= 3.0) {
    currentZoom = newZoom;
    document.getElementById("workspace-container").style.transform = `scale(${currentZoom})`;
    updateZoomDisplay();
  }
}

function resetZoom() {
  currentZoom = 1;
  document.getElementById("workspace-container").style.transform = `scale(1)`;
  document.getElementById("workspace-wrapper").scrollLeft = 0;
  document.getElementById("workspace-wrapper").scrollTop = 0;
  updateZoomDisplay();
}

document.getElementById("workspace-wrapper").addEventListener("scroll", function () {
  document.getElementById("positionIndicator").textContent = `X: ${Math.round(this.scrollLeft)} | Y: ${Math.round(this.scrollTop)}`;
});

/* ==========================================================================
   LOGIQUE DE RENDU & CONNEXIONS
   ========================================================================== */
function updateConnectionsOnly() {
  const layer = document.getElementById("connections-layer");
  layer.innerHTML = "";

  const childrenByParent = {};
  equipments.forEach((eq) => {
    if (eq.parent) {
      if (!childrenByParent[eq.parent]) childrenByParent[eq.parent] = [];
      childrenByParent[eq.parent].push(eq);
    }
  });

  equipments.forEach((eq) => {
    if (eq.parent) {
      const parent = equipments.find((e) => e.id === eq.parent);
      if (parent) {
        // Initialiser les ports s'ils n'existent pas
        if (eq.sourcePort === undefined || eq.targetPort === undefined) {
          const preferredSide = determinePreferredSide(parent, eq.x, eq.y);
          eq.sourcePort = findFreePort(eq.parent, preferredSide);
          eq.targetPort = findFreePort(eq.id, preferredSide === 'bottom' ? 'top' : 'bottom');
        }
        
        // Obtenir les positions des ports
        const startPos = getPortPosition(parent, eq.sourcePort);
        const endPos = getPortPosition(eq, eq.targetPort);
        
        const startX = startPos.x;
        const startY = startPos.y;
        const endX = endPos.x;
        const endY = endPos.y;

        // Initialiser les points de contrôle s'ils n'existent pas
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        
        if (!eq.controlPoints || eq.controlPoints.length !== 3) {
          eq.controlPoints = [
            { x: startX + (midX - startX) * 0.3, y: startY + (midY - startY) * 0.3 },
            { x: midX, y: midY },
            { x: endX - (endX - midX) * 0.3, y: endY - (endY - midY) * 0.3 }
          ];
        }

        // Utiliser les points de contrôle personnalisés
        const cp = eq.controlPoints;
        const pathData = `M ${startX} ${startY} L ${cp[0].x} ${cp[0].y} L ${cp[1].x} ${cp[1].y} L ${cp[2].x} ${cp[2].y} L ${endX} ${endY}`;
        const style = eq.connectionStyle || { color: "#007AFF", width: 2, dasharray: "" };

        const visiblePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        visiblePath.setAttribute("d", pathData);
        visiblePath.setAttribute("stroke", style.color);
        visiblePath.setAttribute("stroke-width", style.width);
        if (style.dasharray) visiblePath.setAttribute("stroke-dasharray", style.dasharray);
        visiblePath.setAttribute("stroke-linejoin", "round");
        visiblePath.setAttribute("stroke-linecap", "round");
        visiblePath.setAttribute("fill", "none");
        visiblePath.style.pointerEvents = "none";

        const hitAreaPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        hitAreaPath.setAttribute("d", pathData);
        hitAreaPath.setAttribute("stroke", "transparent");
        hitAreaPath.setAttribute("stroke-width", "50"); // Augmenté à 50px pour faciliter encore plus le clic
        hitAreaPath.setAttribute("fill", "none");
        hitAreaPath.style.pointerEvents = "stroke";
        hitAreaPath.style.cursor = "pointer";
        
        // Clic gauche : sélectionner et afficher les poignées
        hitAreaPath.addEventListener("click", (e) => {
          e.stopPropagation();
          selectConnection(eq.id, visiblePath, e);
        });
        
        // Clic droit : ouvrir le menu contextuel
        hitAreaPath.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectConnection(eq.id, visiblePath, e);
          openConnectionMenu(e, eq.id);
        });

        layer.appendChild(hitAreaPath);
        layer.appendChild(visiblePath);

        // NOUVEAU : Afficher les poignées si ce lien est sélectionné
        if (selectedConnectionId === eq.id) {
          drawControlHandles(eq, layer);// Les points bleus (courbe
          drawPortHandles(eq, parent, layer); // Poignées orange aux extrémités
        }
      }
    }

    // GESTION DES COUPLES RADIO (LIGNE POINTILLÉE + ÉTIQUETTE)
    if (eq.linkedTo && eq.id < eq.linkedTo) {
      const partner = equipments.find((e) => e.id === eq.linkedTo);
      if (partner) {
        // 1. Coordonnées de départ et d'arrivée (Centre du boitier environ)
        const x1 = eq.x + 80;
        const y1 = eq.y + 60; // +60 pour être au milieu verticalement
        const x2 = partner.x + 80;
        const y2 = partner.y + 60;

        // 2. Dessiner la ligne pointillée
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M ${x1} ${y1} L ${x2} ${y2}`);
        path.setAttribute("stroke", "#007AFF");
        path.setAttribute("stroke-width", "2");
        path.setAttribute("stroke-dasharray", "5,5"); // Effet pointillé
        path.setAttribute("fill", "none");
        layer.appendChild(path);

        // 3. Calculer le milieu pour le texte
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        // 4. Extraire le numéro du lien (ex: "PE12" -> "12")
        // On cherche les chiffres dans le nom de l'équipement
        const numMatch = eq.deviceName.match(/\d+/);
        const linkNum = numMatch ? numMatch[0] : "?";
        const labelText = `LIEN ${linkNum}`;

        // 5. Créer un groupe SVG pour l'étiquette
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        
        // Fond blanc (rect) pour que le texte soit lisible sur la ligne
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        const textWidth = 50; // Largeur approximative
        const textHeight = 20;
        rect.setAttribute("x", midX - (textWidth / 2));
        rect.setAttribute("y", midY - (textHeight / 2));
        rect.setAttribute("width", textWidth);
        rect.setAttribute("height", textHeight);
        rect.setAttribute("fill", "white");
        rect.setAttribute("rx", "4"); // Coins arrondis
        rect.setAttribute("stroke", "#007AFF");
        rect.setAttribute("stroke-width", "1");
        
        // Le Texte
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", midX);
        text.setAttribute("y", midY);
        text.setAttribute("text-anchor", "middle"); // Centré horizontalement
        text.setAttribute("dominant-baseline", "middle"); // Centré verticalement
        text.setAttribute("fill", "#007AFF");
        text.setAttribute("font-size", "10px");
        text.setAttribute("font-weight", "bold");
        text.setAttribute("font-family", "Arial");
        text.textContent = labelText;

        // Ajouter au calque
        group.appendChild(rect);
        group.appendChild(text);
        layer.appendChild(group);
      }
    }
  });
}

/* ==========================================================================
   NOUVEAU : POIGNÉES DE CONTRÔLE POUR MODIFIER LA FORME DES LIENS
   ========================================================================== */
function drawControlHandles(equipment, svg) {
  if (!equipment.controlPoints || equipment.controlPoints.length !== 3) return;

  equipment.controlPoints.forEach((cp, index) => {
    const handle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    handle.setAttribute("cx", cp.x);
    handle.setAttribute("cy", cp.y);
    handle.setAttribute("r", 6);
    handle.setAttribute("fill", "#007AFF");
    handle.setAttribute("stroke", "white");
    handle.setAttribute("stroke-width", 2);
    handle.style.cursor = "move";
    handle.style.pointerEvents = "all"; // IMPORTANT : Rendre la poignée cliquable
    handle.dataset.equipmentId = equipment.id;
    handle.dataset.handleIndex = index;

    // Drag des poignées
    handle.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      startDraggingHandle(equipment.id, index, e);
    });

    svg.appendChild(handle);
  });
}

function startDraggingHandle(equipmentId, handleIndex, e) {
  isDraggingHandle = true;
  draggedHandle = { equipmentId, handleIndex };
  
  // Empêcher la sélection de texte pendant le drag
  document.body.style.userSelect = 'none';
  
  e.preventDefault();

  const onMouseMove = (moveEvent) => {
    if (!isDraggingHandle) return;

    moveEvent.preventDefault();
    
    const container = document.getElementById("workspace-container");
    const rect = container.getBoundingClientRect();
    const x = (moveEvent.clientX - rect.left) / currentZoom;
    const y = (moveEvent.clientY - rect.top) / currentZoom;

    const eq = equipments.find(e => e.id === equipmentId);
    if (eq && eq.controlPoints && eq.controlPoints[handleIndex]) {
      eq.controlPoints[handleIndex].x = x;
      eq.controlPoints[handleIndex].y = y;
      updateConnectionsOnly();
      markAsUnsaved();
    }
  };

  const onMouseUp = () => {
    if (isDraggingHandle) {
      isDraggingHandle = false;
      draggedHandle = null;
      document.body.style.userSelect = '';
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}

/* ==========================================================================
   POIGNÉES DE PORT (ORANGE) POUR REBRANCHER LES LIENS
   ========================================================================== */
function drawPortHandles(equipment, parentEquipment, svg) {
  // Poignée source (côté parent)
  const sourcePos = getPortPosition(parentEquipment, equipment.sourcePort);
  const sourceHandle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  sourceHandle.setAttribute("cx", sourcePos.x);
  sourceHandle.setAttribute("cy", sourcePos.y);
  sourceHandle.setAttribute("r", 8);
  sourceHandle.setAttribute("fill", "#FF9500");
  sourceHandle.setAttribute("stroke", "white");
  sourceHandle.setAttribute("stroke-width", 2);
  sourceHandle.style.cursor = "grab";
  sourceHandle.style.pointerEvents = "all";
  sourceHandle.dataset.equipmentId = equipment.id;
  sourceHandle.dataset.endType = "source";

  sourceHandle.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    e.preventDefault();
    startDraggingPortHandle(equipment.id, "source", e);
  });

  svg.appendChild(sourceHandle);

  // Poignée target (côté enfant)
  const targetPos = getPortPosition(equipment, equipment.targetPort);
  const targetHandle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  targetHandle.setAttribute("cx", targetPos.x);
  targetHandle.setAttribute("cy", targetPos.y);
  targetHandle.setAttribute("r", 8);
  targetHandle.setAttribute("fill", "#FF9500");
  targetHandle.setAttribute("stroke", "white");
  targetHandle.setAttribute("stroke-width", 2);
  targetHandle.style.cursor = "grab";
  targetHandle.style.pointerEvents = "all";
  targetHandle.dataset.equipmentId = equipment.id;
  targetHandle.dataset.endType = "target";

  targetHandle.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    e.preventDefault();
    startDraggingPortHandle(equipment.id, "target", e);
  });

  svg.appendChild(targetHandle);
}

let isDraggingPort = false;
let draggedPort = null;
let tempLine = null;

function startDraggingPortHandle(equipmentId, endType, e) {
  isDraggingPort = true;
  draggedPort = { equipmentId, endType };
  
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'grabbing';
  
  const eq = equipments.find(e => e.id === equipmentId);
  if (!eq) return;
  
  // Créer une ligne temporaire pour visualiser le drag
  const svg = document.getElementById("connections-layer");
  tempLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  tempLine.setAttribute("stroke", "#FF9500");
  tempLine.setAttribute("stroke-width", "3");
  tempLine.setAttribute("stroke-dasharray", "5,5");
  tempLine.style.pointerEvents = "none";
  svg.appendChild(tempLine);
  
  e.preventDefault();

  const onMouseMove = (moveEvent) => {
    if (!isDraggingPort) return;

    moveEvent.preventDefault();
    
    const container = document.getElementById("workspace-container");
    const rect = container.getBoundingClientRect();
    const x = (moveEvent.clientX - rect.left) / currentZoom;
    const y = (moveEvent.clientY - rect.top) / currentZoom;

    // Mettre à jour la ligne temporaire
    if (tempLine) {
      const eq = equipments.find(e => e.id === equipmentId);
      if (endType === "source") {
        const targetPos = getPortPosition(eq, eq.targetPort);
        tempLine.setAttribute("x1", x);
        tempLine.setAttribute("y1", y);
        tempLine.setAttribute("x2", targetPos.x);
        tempLine.setAttribute("y2", targetPos.y);
      } else {
        const parent = equipments.find(e => e.id === eq.parent);
        const sourcePos = getPortPosition(parent, eq.sourcePort);
        tempLine.setAttribute("x1", sourcePos.x);
        tempLine.setAttribute("y1", sourcePos.y);
        tempLine.setAttribute("x2", x);
        tempLine.setAttribute("y2", y);
      }
    }
  };

  const onMouseUp = (upEvent) => {
    if (isDraggingPort) {
      const container = document.getElementById("workspace-container");
      const rect = container.getBoundingClientRect();
      const x = (upEvent.clientX - rect.left) / currentZoom;
      const y = (upEvent.clientY - rect.top) / currentZoom;

      // Trouver l'équipement survolé
      const hoveredEquipment = findEquipmentAtPosition(x, y);
      
      if (hoveredEquipment) {
        const eq = equipments.find(e => e.id === equipmentId);
        const newPort = findClosestPort(hoveredEquipment, x, y);
        
        if (endType === "source") {
          // Rebrancher la source
          eq.parent = hoveredEquipment.id;
          eq.sourcePort = newPort;
        } else {
          // Rebrancher la cible (pas de changement de parent, juste de port)
          eq.targetPort = newPort;
        }
        
        // Réinitialiser les points de contrôle
        delete eq.controlPoints;
        
        markAsUnsaved();
        updateConnectionsOnly();
        showToast("🔌 Lien rebranché !");
      }
      
      // Nettoyer
      if (tempLine) {
        tempLine.remove();
        tempLine = null;
      }
      
      isDraggingPort = false;
      draggedPort = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}

function findEquipmentAtPosition(x, y) {
  for (let eq of equipments) {
    if (x >= eq.x && x <= eq.x + 160 && y >= eq.y && y <= eq.y + 120) {
      return eq;
    }
  }
  return null;
}

function render() {
  document.querySelectorAll(".node").forEach((el) => el.remove());
  equipments.forEach((eq) => {
    const div = document.createElement("div");
    div.className = "node";
    div.id = eq.id;
    div.style.left = eq.x + "px";
    div.style.top = eq.y + "px";
    if (eq.id === selectedEquipmentId) div.classList.add("selected");

    let photoHtml = eq.photo ? `<div class="photo-section"><img src="${eq.photo}" class="field-photo"><div class="photo-badge">📷</div></div>` : "";
    if (eq.photo) div.classList.add("node-with-photo");

    div.innerHTML = `
      <div class="quick-delete-btn" onclick="deleteThisEquipment('${eq.id}', event)">✕</div>
      <div class="quick-add-btn" onclick="quickAddChild('${eq.id}', event)">+</div>
      ${photoHtml}
      <div class="icon">${getIcon(eq.type)}</div>
      <div class="device-name">${eq.deviceName}</div>
      ${eq.ip ? `<div class="ip-addr">${eq.ip}</div>` : ""}
      <div class="loc">${eq.loc}</div>
      <div class="ports-container"></div>`;

    if (eq.photo) {
      const photoSec = div.querySelector(".photo-section");
      if(photoSec) {
          photoSec.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            selectedEquipmentId = eq.id;
            openPhotoViewer(eq.photo);
          });
      }
    }

    // NOUVEAU : Afficher les ports au survol
    div.addEventListener("mouseenter", () => {
      showPorts(eq, div);
    });

    div.addEventListener("mouseleave", () => {
      hidePorts(div);
    });

    div.addEventListener("mousedown", startDrag);
    div.addEventListener("touchstart", startDrag, { passive: false });
    div.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isPenMode) { handlePenModeClick(eq.id); return; }
      deselectAll();
      div.classList.add("selected");
      selectedEquipmentId = eq.id;
      updateFloatingButtons();
    });
    div.addEventListener("dblclick", (e) => {
      if (!e.target.closest(".photo-section")) { e.stopPropagation(); openEditModal(eq.id); }
    });
    document.getElementById("workspace-container").appendChild(div);
  });
  updateConnectionsOnly();
}

/* ==========================================================================
   NOUVEAU : AFFICHAGE DES 20 PORTS SUR LES ÉQUIPEMENTS
   ========================================================================== */
/* CORRECTION DE LA FONCTION SHOWPORTS */
function showPorts(equipment, nodeElement) {
  const portsContainer = nodeElement.querySelector('.ports-container');
  if (!portsContainer) return;
  
  portsContainer.innerHTML = '';
  
  for (let i = 0; i < 20; i++) {
    const portPos = getPortPosition(equipment, i);
    
    // Calcul de la position relative
    const relX = portPos.x - equipment.x;
    const relY = portPos.y - equipment.y;
    
    const portDot = document.createElement('div');
    portDot.className = 'port-dot';
    portDot.style.left = relX + 'px';
    portDot.style.top = relY + 'px';
    
    // Stocker les infos dans le DOM pour les retrouver facilement
    portDot.dataset.eqId = equipment.id;
    portDot.dataset.portIndex = i;

    // Événement Souris : Démarrer la création de lien
    portDot.addEventListener("mousedown", (e) => {
        e.stopPropagation(); // Empêche de bouger l'équipement
        e.preventDefault();  // Empêche la sélection de texte
        startLinkCreation(equipment.id, i, e); // <--- LANCE LA CRÉATION
    });
    
    // Feedback visuel si le port est utilisé
    if (isPortUsed(equipment.id, i)) {
      portDot.classList.add('port-used');
    }
    
    portsContainer.appendChild(portDot);
  }
}

function hidePorts(nodeElement) {
  const portsContainer = nodeElement.querySelector('.ports-container');
  if (portsContainer) {
    portsContainer.innerHTML = '';
  }
}

function isPortUsed(equipmentId, portIndex) {
  // Vérifier si le port est utilisé comme source
  const asSource = equipments.some(eq => 
    eq.parent === equipmentId && eq.sourcePort === portIndex
  );
  
  // Vérifier si le port est utilisé comme target
  const asTarget = equipments.some(eq => 
    eq.id === equipmentId && eq.targetPort === portIndex
  );
  
  return asSource || asTarget;
}

/* ==========================================================================
   NOUVEAU : CRÉATION DE LIENS (DRAG & DROP DEPUIS LES PORTS VERTS)
   ========================================================================== */

function startLinkCreation(eqId, portIndex, e) {
  isCreatingLink = true;
  linkStartData = { id: eqId, portIndex: portIndex };
  
  // Créer une ligne temporaire visuelle
  const svg = document.getElementById("connections-layer");
  tempLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  tempLine.setAttribute("stroke", "#34C759"); // Vert
  tempLine.setAttribute("stroke-width", "3");
  tempLine.setAttribute("stroke-dasharray", "5,5");
  tempLine.setAttribute("pointer-events", "none"); // Important pour cliquer au travers
  svg.appendChild(tempLine);

  // Position de départ
  const startEq = equipments.find(e => e.id === eqId);
  const startPos = getPortPosition(startEq, portIndex);
  
  tempLine.setAttribute("x1", startPos.x);
  tempLine.setAttribute("y1", startPos.y);
  tempLine.setAttribute("x2", startPos.x);
  tempLine.setAttribute("y2", startPos.y);

  // Ajouter les écouteurs globaux
  document.addEventListener("mousemove", onLinkMove);
  document.addEventListener("mouseup", onLinkUp);
}

function onLinkMove(e) {
  if (!isCreatingLink || !tempLine) return;
  
  const container = document.getElementById("workspace-container");
  const rect = container.getBoundingClientRect();
  
  // Coordonnées souris corrigées du zoom
  const mouseX = (e.clientX - rect.left) / currentZoom;
  const mouseY = (e.clientY - rect.top) / currentZoom;
  
  tempLine.setAttribute("x2", mouseX);
  tempLine.setAttribute("y2", mouseY);
}

function onLinkUp(e) {
  if (!isCreatingLink) return;

  // 1. Nettoyage
  if (tempLine) tempLine.remove();
  document.removeEventListener("mousemove", onLinkMove);
  document.removeEventListener("mouseup", onLinkUp);
  isCreatingLink = false;

  // 2. Vérifier si on a relâché sur un port vert
  // On utilise elementFromPoint pour trouver ce qu'il y a sous la souris
  const targetEl = document.elementFromPoint(e.clientX, e.clientY);
  
  if (targetEl && targetEl.classList.contains('port-dot')) {
      const targetEqId = targetEl.dataset.eqId;
      const targetPortIndex = parseInt(targetEl.dataset.portIndex);
      
      // Sécurités
      if (targetEqId === linkStartData.id) {
          showToast("❌ Impossible de connecter un équipement à lui-même");
          linkStartData = null;
          return;
      }

      finishLinkCreation(linkStartData.id, linkStartData.portIndex, targetEqId, targetPortIndex);
  }
  
  linkStartData = null;
}

function finishLinkCreation(sourceId, sourcePort, targetId, targetPort) {
    const sourceEq = equipments.find(e => e.id === sourceId);
    const targetEq = equipments.find(e => e.id === targetId);

    // LOGIQUE PARENT / ENFANT
    // Dans votre système actuel, l'enfant porte la référence du parent.
    // On considère que celui sur lequel on a RELACHÉ la souris devient l'ENFANT.
    // (Sauf s'il a déjà un parent, on demande confirmation)

    if (targetEq.parent) {
        if (!confirm(`Attention : ${targetEq.deviceName} est déjà connecté.\nVoulez-vous remplacer sa connexion ?`)) {
            return;
        }
    }

    // Appliquer la connexion
    targetEq.parent = sourceId;
    targetEq.sourcePort = sourcePort; // Le port du parent (Source)
    targetEq.targetPort = targetPort; // Le port de l'enfant (Target)
    
    // Réinitialiser le style de courbe pour qu'il soit recalculé proprement
    delete targetEq.controlPoints;

    saveState();
    render();
    markAsUnsaved();
    showToast(`✅ Connecté : ${sourceEq.deviceName} ➝ ${targetEq.deviceName}`);
}

/* ==========================================================================
   DRAG & DROP
   ========================================================================== */
function startDrag(e) {
  if (isSelectionMode || isPenMode) return;
  if (e.target.classList.contains("quick-add-btn") || e.target.classList.contains("quick-delete-btn")) return;
  if (e.target.classList.contains("port-dot")) return;

  activeDragId = e.currentTarget.id;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  dragStartX = clientX;
  dragStartY = clientY;
  
  const eq = equipments.find((item) => item.id === activeDragId);
  initialObjX = eq.x;
  initialObjY = eq.y;

  if (multiSelectedIds.includes(activeDragId)) {
    multiDragInitialPositions = {};
    multiDragControlPoints = {}; // Réinitialiser

    multiSelectedIds.forEach((id) => {
      const equipment = equipments.find((e) => e.id === id);
      if (equipment) {
        // 1. Sauver la position de l'objet
        multiDragInitialPositions[id] = { x: equipment.x, y: equipment.y };

        // 2. NEW : Sauver la position des points de contrôle (si le lien bouge aussi)
        // On ne le fait que si l'équipement a un parent qui est AUSSI sélectionné
        if (equipment.parent && multiSelectedIds.includes(equipment.parent) && equipment.controlPoints) {
            // On fait une copie profonde du tableau pour ne pas modifier la référence
            multiDragControlPoints[id] = equipment.controlPoints.map(p => ({ x: p.x, y: p.y }));
        }
      }
    });
  } else {
    multiDragInitialPositions = {};
    multiDragControlPoints = {};
  }

  document.addEventListener("mousemove", onDrag);
  document.addEventListener("touchmove", onDrag, { passive: false });
  document.addEventListener("mouseup", endDrag);
  document.addEventListener("touchend", endDrag);
}

function onDrag(e) {
  if (!activeDragId) return;
  e.preventDefault();

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  
  const deltaX = (clientX - dragStartX) / currentZoom;
  const deltaY = (clientY - dragStartY) / currentZoom;

  const snap = (val) => Math.round(val / GRID_SIZE) * GRID_SIZE;

  if (Object.keys(multiDragInitialPositions).length > 0) {
    // Cas 1 : Déplacement de groupe
    Object.keys(multiDragInitialPositions).forEach((id) => {
      const eq = equipments.find((item) => item.id === id);
      if (eq) {
        // Calcul de la nouvelle position
        const rawX = multiDragInitialPositions[id].x + deltaX;
        const rawY = multiDragInitialPositions[id].y + deltaY;
        
        const newX = Math.max(0, snap(rawX));
        const newY = Math.max(0, snap(rawY));

        // Calcul du déplacement RÉEL (après snap grille) pour l'appliquer aux courbes
        const effectiveMoveX = newX - multiDragInitialPositions[id].x;
        const effectiveMoveY = newY - multiDragInitialPositions[id].y;

        eq.x = newX;
        eq.y = newY;
        
        const el = document.getElementById(id);
        if (el) { el.style.left = eq.x + "px"; el.style.top = eq.y + "px"; }

        // --- NEW : Déplacer aussi les points de contrôle (courbes) ---
        if (multiDragControlPoints[id]) {
            eq.controlPoints = multiDragControlPoints[id].map(p => ({
                x: p.x + effectiveMoveX,
                y: p.y + effectiveMoveY
            }));
        }
        // -------------------------------------------------------------
      }
    });
  } else {
    // Cas 2 : Déplacement unique
    const eq = equipments.find((item) => item.id === activeDragId);
    
    const rawX = initialObjX + deltaX;
    const rawY = initialObjY + deltaY;

    eq.x = Math.max(0, snap(rawX));
    eq.y = Math.max(0, snap(rawY));
    
    const el = document.getElementById(activeDragId);
    el.style.left = eq.x + "px";
    el.style.top = eq.y + "px";
  }
  
  updateConnectionsOnly();
}

function endDrag() {
  if (activeDragId) { // On vérifie qu'on a bien bougé quelque chose
        activeDragId = null;
        markAsUnsaved();
        saveState(); // <--- AJOUTER ICI
    }
  document.removeEventListener("mousemove", onDrag);
  document.removeEventListener("touchmove", onDrag);
  document.removeEventListener("mouseup", endDrag);
  document.removeEventListener("touchend", endDrag);
}

/* ==========================================================================
   MODALES ET FORMULAIRES
   ========================================================================== */
function openAddModal() {
  closeConnectionMenu();
  document.querySelectorAll(".floating-ui").forEach((el) => el.classList.add("modal-open"));
  const sel = document.getElementById("newParent");
  sel.innerHTML = '<option value="">-- Racine --</option>';
  equipments.forEach((eq) => (sel.innerHTML += `<option value="${eq.id}">${eq.deviceName}</option>`));
  editingEquipmentId = null;
  document.getElementById("modalTitle").innerText = "Nouvel Équipement";
  document.getElementById("modalActionBtn").innerText = "Ajouter";
  document.getElementById("newType").value = "switch";
  updateFormFields("switch");
  document.getElementById("addModal").style.display = "flex";
}

function openEditModal(id) {
  const eq = equipments.find((e) => e.id === id);
  if (!eq) return;
  closeConnectionMenu();
  document.querySelectorAll(".floating-ui").forEach((el) => el.classList.add("modal-open"));

  const sel = document.getElementById("newParent");
  sel.innerHTML = '<option value="">-- Racine --</option>';
  equipments.forEach((e) => {
    if (e.id !== id) sel.innerHTML += `<option value="${e.id}">${e.deviceName}</option>`;
  });

  editingEquipmentId = id;
  document.getElementById("modalTitle").innerText = "Modifier l'Équipement";
  document.getElementById("modalActionBtn").innerText = "Modifier";
  document.getElementById("newType").value = eq.type;

  if (eq.type === "radio") {
    document.getElementById("radioModeGroup").style.display = "block";
    if (eq.linkedTo) {
      document.getElementById("radioMode").value = "couple";
      updateRadioFields(eq.deviceName, eq.ip);
      const partner = equipments.find((e) => e.id === eq.linkedTo);
      let isPE = eq.deviceName.startsWith("PE") || eq.id < partner.id;
      if (isPE) {
        document.getElementById("newLocation").value = eq.loc;
        document.getElementById("newLocationPR").value = partner ? partner.loc : "";
      } else {
        document.getElementById("newLocation").value = partner ? partner.loc : "";
        document.getElementById("newLocationPR").value = eq.loc;
      }
    } else {
      document.getElementById("radioMode").value = eq.deviceName.startsWith("PE") ? "pe" : "pr";
      updateRadioFields(eq.deviceName, eq.ip);
      document.getElementById("newLocation").value = eq.loc;
    }
  } else {
    updateFormFields(eq.type, eq.deviceName, eq.ip);
    document.getElementById("newLocation").value = eq.loc;
  }

  document.getElementById("newParent").value = eq.parent || "";
  document.getElementById("addModal").style.display = "flex";
}

function closeAddModal() {
  document.getElementById("addModal").style.display = "none";
  document.querySelectorAll(".floating-ui").forEach((el) => el.classList.remove("modal-open"));
  editingEquipmentId = null;
  suggestedX = null;
  suggestedY = null;
}

function updateFormFields(type, currentName = "", currentIP = "") {
  const radioModeGroup = document.getElementById("radioModeGroup");
  const quantityGroup = document.getElementById("quantityGroup");
  const hpGroup = document.getElementById("hpGroup");

  document.getElementById("locationLabel").innerText = "Localisation";
  document.getElementById("locationPRGroup").style.display = "none";

  radioModeGroup.style.display = "none";
  quantityGroup.style.display = "none";
  hpGroup.style.display = "none";
  document.getElementById("radioCoupleQuantityGroup").style.display = "none";

  if (type === "radio") {
    radioModeGroup.style.display = "block";
    updateRadioFields(currentName, currentIP);
    return;
  } else if (type === "ampli") {
    hpGroup.style.display = "block";
    updateHPFields();
  }

  if (!editingEquipmentId && presetsByType[type]) {
    quantityGroup.style.display = "block";
  }

  const presets = presetsByType[type];
  if (presets) {
    const nameIndex = presets.names.indexOf(currentName);
    const isManual = currentName && nameIndex === -1;
    if (isManual) renderInputs(currentName, currentIP);
    else renderSelects(type, currentName, currentIP);
  } else {
    renderInputs(currentName, currentIP);
  }
}

function updateRadioFields(currentName = "", currentIP = "") {
  const mode = document.getElementById("radioMode").value;
  const nameContainer = document.getElementById("nameFieldContainer");
  const ipContainer = document.getElementById("ipFieldContainer");

  if (mode === "couple") {
    document.getElementById("locationLabel").innerText = "Localisation PE";
    document.getElementById("locationPRGroup").style.display = "block";
    document.getElementById("newLocationPR").placeholder = "Ex: Toit bâtiment B";
    document.getElementById("radioCoupleQuantityGroup").style.display = "block";

    let html = `<select id="newDeviceName">`;
    html += `<option value="">-- Choisir Couple --</option>`;
    radioData.couples.forEach((couple, index) => {
      html += `<option value="${index}" data-type="couple">${couple.label}</option>`;
    });
    html += `<option value="__manual__">Saisie manuelle</option></select>`;
    nameContainer.innerHTML = html;
    ipContainer.innerHTML = `<input type="text" id="newIP" value="Automatique (2 IPs)" disabled style="background:#eee; color:#666;">`;
  } else if (mode === "pe") {
    document.getElementById("locationLabel").innerText = "Localisation";
    document.getElementById("locationPRGroup").style.display = "none";
    document.getElementById("radioCoupleQuantityGroup").style.display = "none";
    renderRadioSelects(radioData.pe, currentName, currentIP);
  } else if (mode === "pr") {
    document.getElementById("locationLabel").innerText = "Localisation";
    document.getElementById("locationPRGroup").style.display = "none";
    document.getElementById("radioCoupleQuantityGroup").style.display = "none";
    renderRadioSelects(radioData.pr, currentName, currentIP);
  }
}

function updateHPFields() {
  const hpCount = parseInt(document.getElementById("hpCount")?.value || 1);
  const container = document.getElementById("hpNamesContainer");
  if (!container) return;
  let html = "";
  for (let i = 1; i <= hpCount; i++) {
    html += `<div class="hp-name-field"><label>HP${i} :</label><input type="text" id="hpName${i}" placeholder="Ex: HP${i}..." value="HP${i}"></div>`;
  }
  container.innerHTML = html;
}

document.getElementById("radioMode").addEventListener("change", function () {
  updateRadioFields();
});

function renderRadioSelects(data, nameVal, ipVal) {
  let nameHtml = `<select id="newDeviceName" onchange="syncRadioIP(this)">`;
  nameHtml += `<option value="">-- Choisir --</option>`;
  data.names.forEach((name, index) => {
    const selected = name === nameVal ? "selected" : "";
    nameHtml += `<option value="${name}" data-ip="${data.ips[index]}" ${selected}>${name}</option>`;
  });
  nameHtml += `<option value="__manual__">Saisie manuelle...</option></select>`;
  document.getElementById("nameFieldContainer").innerHTML = nameHtml;

  let ipHtml = `<select id="newIP">`;
  ipHtml += `<option value="">-- Auto --</option>`;
  data.ips.forEach((ip) => {
    const selected = ip === ipVal ? "selected" : "";
    ipHtml += `<option value="${ip}" ${selected}>${ip}</option>`;
  });
  ipHtml += `<option value="__manual__">Saisie manuelle...</option></select>`;
  document.getElementById("ipFieldContainer").innerHTML = ipHtml;

  document.getElementById("newIP").addEventListener("change", function () {
    if (this.value === "__manual__") renderInputs("", "");
  });
}

function syncRadioIP(select) {
  const ipSelect = document.getElementById("newIP");
  if (select.value === "__manual__") {
    renderInputs("", "");
  } else {
    const selectedOption = select.options[select.selectedIndex];
    const ip = selectedOption.getAttribute("data-ip");
    if (ip) ipSelect.value = ip;
  }
}

function renderInputs(nameVal, ipVal) {
  document.getElementById("nameFieldContainer").innerHTML = `<input type="text" id="newDeviceName" placeholder="Ex: Switch-RDC" value="${nameVal}">`;
  document.getElementById("ipFieldContainer").innerHTML = `<input type="text" id="newIP" placeholder="Ex: 192.168.1.10" value="${ipVal}">`;
}

function renderSelects(type, nameVal, ipVal) {
  const presets = presetsByType[type];
  let nameHtml = `<select id="newDeviceName" onchange="syncIPFromSelect('${type}')">`;
  nameHtml += `<option value="">-- Choisir --</option>`;
  presets.names.forEach((name, index) => {
    const selected = name === nameVal ? "selected" : "";
    nameHtml += `<option value="${name}" data-index="${index}" ${selected}>${name}</option>`;
  });
  nameHtml += `<option value="__manual__">Saisie manuelle...</option></select>`;
  document.getElementById("nameFieldContainer").innerHTML = nameHtml;

  let ipHtml = `<select id="newIP">`;
  ipHtml += `<option value="">-- Auto --</option>`;
  presets.ips.forEach((ip) => {
    const selected = ip === ipVal ? "selected" : "";
    ipHtml += `<option value="${ip}" ${selected}>${ip}</option>`;
  });
  ipHtml += `<option value="__manual__">Saisie manuelle...</option></select>`;
  document.getElementById("ipFieldContainer").innerHTML = ipHtml;

  document.getElementById("newIP").addEventListener("change", function () {
    if (this.value === "__manual__") renderInputs("", "");
  });
}

function syncIPFromSelect(type) {
  const nameSelect = document.getElementById("newDeviceName");
  const ipSelect = document.getElementById("newIP");
  if (nameSelect.value === "__manual__") {
    renderInputs("", "");
  } else {
    const selectedOption = nameSelect.options[nameSelect.selectedIndex];
    const index = selectedOption.getAttribute("data-index");
    if (index !== null && presetsByType[type].ips[index]) {
      ipSelect.value = presetsByType[type].ips[index];
    }
  }
}

function getNextNEquipments(type, quantity) {
  const presets = presetsByType[type];
  if (!presets) return [];
  const usedNames = equipments.filter((eq) => eq.type === type).map((eq) => eq.deviceName);
  const usedIPs = equipments.map((eq) => eq.ip);
  const result = [];
  let nameIndex = 0;
  let ipIndex = 0;
  while (result.length < quantity && nameIndex < presets.names.length) {
    const name = presets.names[nameIndex];
    const ip = presets.ips[ipIndex];
    if (!usedNames.includes(name) && !usedIPs.includes(ip)) {
      result.push({ name, ip });
      usedNames.push(name);
      usedIPs.push(ip);
    }
    nameIndex++;
    ipIndex++;
  }
  return result;
}

function addEquipment() {
  const type = document.getElementById("newType").value;
  const locPE = document.getElementById("newLocation").value || "Lieu PE";
  const locPR = document.getElementById("newLocationPR").value || "Lieu PR";
  const parent = document.getElementById("newParent").value || null;
  const deviceName = document.getElementById("newDeviceName").value || "Appareil";
  const ip = document.getElementById("newIP").value || "";

  // --- CAS 1 : MODIFICATION ---
  if (editingEquipmentId) {
    const eq = equipments.find((e) => e.id === editingEquipmentId);
    const radioMode = document.getElementById("radioMode").value;
    if (eq) {
      if (eq.type === "radio" && radioMode === "couple" && eq.linkedTo) {
        const partner = equipments.find((e) => e.id === eq.linkedTo);
        let isPE = eq.deviceName.startsWith("PE") || eq.id < partner.id;
        if (isPE) {
          eq.loc = locPE; eq.parent = null;
          if (partner) { partner.loc = locPR; partner.parent = parent; }
        } else {
          eq.loc = locPR; eq.parent = parent;
          if (partner) { partner.loc = locPE; partner.parent = null; }
        }
      } else {
        eq.type = type; eq.deviceName = deviceName; eq.ip = ip; eq.loc = locPE; eq.parent = parent;
      }
      showToast("Équipement modifié !");
    }
  } 
  
  // --- CAS 2 : AJOUT ---
  else {
    const radioMode = document.getElementById("radioMode").value;
    let quantity = parseInt(document.getElementById("newQuantity").value) || 1;
    if (quantity > 20) quantity = 20;
    
    // Position par défaut
    let scrollX = (document.getElementById("workspace-wrapper").scrollLeft + 200) / currentZoom;
    let scrollY = (document.getElementById("workspace-wrapper").scrollTop + 300) / currentZoom;
    if (suggestedX !== null && suggestedY !== null) {
      scrollX = suggestedX; scrollY = suggestedY;
      suggestedX = null; suggestedY = null;
    }

    // --- SOUS-CAS 2A : RADIO ---
    if (type === "radio" && radioMode === "couple") {
      const select = document.getElementById("newDeviceName");
      const index = select.value;
      if (index === "" || index === "__manual__") {
        addSingleNode(type, deviceName, ip, locPE, parent, scrollX, scrollY);
      } else {
        const coupleQuantity = parseInt(document.getElementById("radioCoupleQuantity").value) || 1;
        for (let i = 0; i < coupleQuantity; i++) {
          const coupleIndex = parseInt(index) + i;
          if (coupleIndex >= radioData.couples.length) break;
          
          const coupleData = radioData.couples[coupleIndex];
          const timestamp = Date.now() + i * 2;
          const idPR = "eq-" + timestamp;
          const idPE = "eq-" + (timestamp + 1);
          const offsetX = i * 400;
          const prParent = i === 0 ? parent : "eq-" + (timestamp - 1);
          
          // Sécurité position Radio
          let finalX = Math.max(50, scrollX + offsetX);
          
          equipments.push({ id: idPR, type: "radio", deviceName: coupleData.prName, ip: coupleData.prIp, loc: locPR, parent: prParent, x: finalX, y: scrollY, linkedTo: idPE });
          equipments.push({ id: idPE, type: "radio", deviceName: coupleData.peName, ip: coupleData.peIp, loc: locPE, parent: null, x: finalX + 200, y: scrollY, linkedTo: idPR });
        }
        showToast("Couples radio ajoutés !");
      }
    } 
    
    // --- SOUS-CAS 2B : AMPLI ---
    else if (type === "ampli") {
      const newEquipmentId = addSingleNode(type, deviceName, ip, locPE, parent, scrollX, scrollY);
      const hpCount = parseInt(document.getElementById("hpCount")?.value || 1);
      const ampliLocation = locPE || "Même lieu que l'ampli";
      for (let i = 1; i <= hpCount; i++) {
        const hpName = document.getElementById(`hpName${i}`)?.value || `HP${i}`;
        // Sécurité position HP
        let hpX = Math.max(50, scrollX + (i - 1) * 220);
        equipments.push({ id: "eq-" + Date.now() + "-hp" + i + Math.random().toString(36).substr(2, 5), type: "hp", deviceName: hpName, ip: "", loc: ampliLocation, parent: newEquipmentId, x: hpX, y: scrollY + 200 });
      }
      showToast(`Ampli + ${hpCount} HP ajoutés !`);
    } 
    
    // --- SOUS-CAS 2C : STANDARD (CORRECTION TOPOLOGIE INTELLIGENTE) ---
    else {
      const presets = presetsByType[type];
      
      if (quantity > 1 && presets) {
        const equipData = getNextNEquipments(type, quantity);
        if (equipData.length === 0) {
          alert(`Plus de noms/IPs disponibles`);
          return;
        }
        
        const SPACING_X = 250; 
        const FIXED_Y_OFFSET = 200; 

        let startX = scrollX;
        let startY = scrollY;

        if (parent) {
            const parentNode = equipments.find(e => e.id === parent);
            if (parentNode) {
                startY = parentNode.y + FIXED_Y_OFFSET;
                const totalRowWidth = (equipData.length - 1) * SPACING_X;
                startX = parentNode.x - (totalRowWidth / 2);
                
                // --- SÉCURITÉ BORDS ---
                // Si le calcul place le premier élément hors champ à gauche (< 50px)
                // On force le démarrage à 50px.
                if (startX < 50) {
                    startX = 50; 
                }
                // ----------------------
            }
        }

        equipments.forEach((eq) => {
             // Petite correction pour éviter superposition si on ajoute au même endroit sans parent
             if (!parent && Math.abs(eq.x - startX) < 50 && Math.abs(eq.y - startY) < 50) {
                 startY += 100; // On décale vers le bas si conflit
             }
        });

        equipData.forEach((data, index) => {
          const x = startX + (index * SPACING_X);
          const y = startY;
          addSingleNode(type, data.name, data.ip, locPE, parent, x, y);
        });
        
        showToast(`${equipData.length} équipements ajoutés !`);
      } 
      else {
        // Sécurité Ajout Unique
        let safeX = Math.max(50, scrollX);
        addSingleNode(type, deviceName, ip, locPE, parent, safeX, scrollY);
        showToast("Équipement ajouté !");
      }
    }
  }
  
  markAsUnsaved();
  selectedEquipmentId = null;
  updateFloatingButtons();
  saveState();
  render();
  closeAddModal();
}

function addSingleNode(type, name, ip, loc, parent, x, y) {
  const newId = "eq-" + Date.now() + Math.random().toString(36).substr(2, 5);
  equipments.push({ id: newId, type: type, deviceName: name, ip: ip, loc: loc, parent: parent, x: x, y: y });
  return newId;
}

function quickAddChild(parentId, e) {
  e.stopPropagation();
  openAddModal();
  document.getElementById("newParent").value = parentId;
  const parentNode = equipments.find((eq) => eq.id === parentId);
  if (parentNode) {
    suggestedX = parentNode.x + 50;
    suggestedY = parentNode.y + 150;
  }
  showToast("Parent pré-sélectionné");
}

/* ==========================================================================
   MODES SPÉCIAUX (STYLO, SÉLECTION, SUPPR ZONE)
   ========================================================================== */
function togglePenMode() {
  isPenMode = !isPenMode;
  const btn = document.getElementById("penBtn");
  if (isPenMode) {
    btn.classList.add("active");
    document.getElementById("workspace-container").style.cursor = "crosshair";
    showToast("✏️ Mode Stylo : Cliquez sur le PARENT puis sur l'ENFANT");
    if (isSelectionMode) toggleSelectionMode();
    if (isMultiSelectMode) toggleMultiSelectMode();
    deselectAll();
    deselectConnection();
    closeConnectionMenu();
    clearMultiSelection();
    penFirstEquipment = null;
  } else {
    btn.classList.remove("active");
    document.getElementById("workspace-container").style.cursor = "default";
    penFirstEquipment = null;
    document.querySelectorAll(".node").forEach((node) => { node.style.border = ""; node.style.boxShadow = ""; });
  }
}

function handlePenModeClick(equipmentId) {
  if (!penFirstEquipment) {
    penFirstEquipment = equipmentId;
    const parentEq = equipments.find(e => e.id === equipmentId);
    showToast(`✅ Parent : ${parentEq.deviceName}. Cliquez sur l'ENFANT`);
    const parentNode = document.getElementById(equipmentId);
    if (parentNode) {
      parentNode.style.border = "4px solid #34C759";
      parentNode.style.boxShadow = "0 0 0 3px rgba(52, 199, 89, 0.3)";
    }
  } else {
    const parentId = penFirstEquipment;
    const childId = equipmentId;
    if (parentId === childId) {
      showToast("❌ Impossible de connecter un équipement à lui-même");
      const parentNode = document.getElementById(parentId);
      if (parentNode) { parentNode.style.border = ""; parentNode.style.boxShadow = ""; }
      penFirstEquipment = null;
      return;
    }
    const childEq = equipments.find(e => e.id === childId);
    if (childEq) {
      if (childEq.parent) {
        const parentEq = equipments.find(e => e.id === parentId);
        const oldParentEq = equipments.find(e => e.id === childEq.parent);
        if (!confirm(`${childEq.deviceName} est déjà connecté à ${oldParentEq?.deviceName || "un équipement"}.\n\nVoulez-vous le reconnecter à ${parentEq.deviceName} ?`)) {
          const parentNode = document.getElementById(parentId);
          if (parentNode) { parentNode.style.border = ""; parentNode.style.boxShadow = ""; }
          penFirstEquipment = null;
          return;
        }
      }
      childEq.parent = parentId;
      if (!childEq.connectionStyle) {
        childEq.connectionStyle = { type: "ethernet", color: "#007AFF", width: 2, dasharray: "" };
      }
      const parentEq = equipments.find(e => e.id === parentId);
      showToast(`✅ Connexion créée :\n${parentEq.deviceName} → ${childEq.deviceName}`);
      const parentNode = document.getElementById(parentId);
      if (parentNode) { parentNode.style.border = ""; parentNode.style.boxShadow = ""; }
      markAsUnsaved();
      saveState();
      render();
      penFirstEquipment = null;
    }
  }
}

function toggleSelectionMode() {
  isSelectionMode = !isSelectionMode;
  const btn = document.getElementById("delZoneBtn");
  const body = document.body;
  if (isSelectionMode) {
    btn.classList.add("active");
    body.classList.add("selection-mode");
    showToast("Mode suppression : Cliquez pour commencer la zone");
    deselectAll();
    closeConnectionMenu();
    if (isPenMode) togglePenMode();
    if (isMultiSelectMode) toggleMultiSelectMode();
  } else {
    btn.classList.remove("active");
    body.classList.remove("selection-mode");
    resetSelectionBox();
  }
}


/* ==========================================================================
   SUPPRESSION DE ZONE (ÉQUIPEMENTS + LIENS)
   ========================================================================== */
function processBulkDelete(start, end) {
  // 1. Calcul des limites de la zone
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);

  // --- ÉTAPE A : Identifier les ÉQUIPEMENTS à supprimer ---
  const nodesToDelete = equipments.filter((eq) => {
    const centerX = eq.x + 80;
    const centerY = eq.y + 60;
    return centerX >= minX && centerX <= maxX && centerY >= minY && centerY <= maxY;
  });
  
  const idsToDelete = nodesToDelete.map((eq) => eq.id);

  // --- ÉTAPE B : Identifier les LIENS à couper ---
  // On cherche les équipements qui NE sont PAS supprimés, mais dont le lien passe dans la zone
  let linksDeletedCount = 0;

  equipments.forEach(eq => {
      // Si l'équipement lui-même va être supprimé, pas besoin de traiter son lien ici
      if (idsToDelete.includes(eq.id)) return;

      // Si l'équipement a un parent (donc un lien) ET des points de contrôle
      if (eq.parent && eq.controlPoints) {
          // On vérifie si UN des 3 points de contrôle est dans le carré rouge
          const isLinkSelected = eq.controlPoints.some(p => 
              p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY
          );

          if (isLinkSelected) {
              // On coupe le lien !
              eq.parent = null;
              delete eq.sourcePort;
              delete eq.targetPort;
              delete eq.controlPoints;
              delete eq.connectionStyle;
              linksDeletedCount++;
          }
      }
  });

  // Si rien n'est sélectionné du tout
  if (idsToDelete.length === 0 && linksDeletedCount === 0) {
    showToast("Rien à supprimer dans la zone");
    return;
  }

  // --- ÉTAPE C : APPLIQUER LA SUPPRESSION DES ÉQUIPEMENTS ---
  if (idsToDelete.length > 0) {
      equipments = equipments.filter((eq) => !idsToDelete.includes(eq.id));

      // Nettoyer les orphelins
      equipments.forEach((eq) => {
        if (idsToDelete.includes(eq.parent)) eq.parent = null;
        if (idsToDelete.includes(eq.linkedTo)) delete eq.linkedTo;
      });
  }

  // Sauvegarde et Rendu
  saveState();
  render();
  markAsUnsaved();
  
  // Message adapté
  let msg = "🗑️ Supprimé : ";
  if (idsToDelete.length > 0) msg += `${idsToDelete.length} équipement(s) `;
  if (idsToDelete.length > 0 && linksDeletedCount > 0) msg += "et ";
  if (linksDeletedCount > 0) msg += `${linksDeletedCount} lien(s)`;
  
  showToast(msg);
}

function processMultiSelect(start, end) {
  const minX = Math.min(start.x, end.x); const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y); const maxY = Math.max(start.y, end.y);
  const toSelect = equipments.filter((eq) => {
    const centerX = eq.x + 80; const centerY = eq.y + 60;
    return centerX >= minX && centerX <= maxX && centerY >= minY && centerY <= maxY;
  });
  if (toSelect.length === 0) { showToast("Aucun équipement dans la zone"); return; }
  multiSelectedIds = toSelect.map((eq) => eq.id);
  document.querySelectorAll(".node").forEach((node) => {
    if (multiSelectedIds.includes(node.id)) node.classList.add("multi-selected");
    else node.classList.remove("multi-selected");
  });
  showToast(`✅ ${multiSelectedIds.length} équipement(s) sélectionné(s)\n\nVous pouvez maintenant les déplacer ensemble`);
  if (multiSelectedIds.length > 1) {
        document.getElementById("alignToolbar").style.display = "flex";
  }
}

function clearMultiSelection() {
  multiSelectedIds = [];
  document.querySelectorAll(".node").forEach((node) => { node.classList.remove("multi-selected"); });
  document.getElementById("alignToolbar").style.display = "none";
}

function toggleMultiSelectMode() {
  isMultiSelectMode = !isMultiSelectMode;
  const btn = document.getElementById("multiSelectBtn");
  const body = document.body;
  if (isMultiSelectMode) {
    btn.classList.add("active");
    body.classList.add("multi-select-mode");
    showToast("⬚ Mode Sélection : Cliquez 2 fois pour créer une zone de sélection");
    if (isSelectionMode) toggleSelectionMode();
    if (isPenMode) togglePenMode();
    deselectAll();
    deselectConnection();
    closeConnectionMenu();
  } else {
    btn.classList.remove("active");
    body.classList.remove("multi-select-mode");
    resetMultiSelectionBox();
  }
}

function selectConnection(childId, pathElement, event) {
  deselectConnection();
  selectedConnectionId = childId;
  selectedConnectionPath = pathElement;
  const originalWidth = pathElement.getAttribute("data-original-width") || pathElement.getAttribute("stroke-width");
  pathElement.setAttribute("data-original-width", originalWidth);
  pathElement.setAttribute("stroke-width", parseInt(originalWidth) + 2);
  pathElement.style.filter = "drop-shadow(0 0 6px rgba(0, 122, 255, 0.6))";
  updateConnectionsOnly(); // Redessiner pour afficher les poignées
  // Menu contextuel ouvert uniquement sur clic droit (voir updateConnectionsOnly)
}

function deselectConnection() {
  if (selectedConnectionPath) {
    const originalWidth = selectedConnectionPath.getAttribute("data-original-width");
    if (originalWidth) selectedConnectionPath.setAttribute("stroke-width", originalWidth);
    selectedConnectionPath.style.filter = "none";
    selectedConnectionPath = null;
  }
  selectedConnectionId = null;
  updateConnectionsOnly(); // Redessiner pour cacher les poignées
}

function openConnectionMenu(event, childId) {
  selectedConnectionId = childId;
  const menu = document.getElementById("connectionMenu");
  const container = document.getElementById("workspace-container");
  const rect = container.getBoundingClientRect();
  const x = (event.clientX - rect.left) / currentZoom;
  const y = (event.clientY - rect.top) / currentZoom;
  menu.style.display = "block";
  menu.style.left = x - 90 + "px";
  menu.style.top = y - 70 + "px";
  setTimeout(() => { document.addEventListener("click", closeConnectionMenu, { once: true }); }, 100);
}

function closeConnectionMenu() {
  document.getElementById("connectionMenu").style.display = "none";
  deselectConnection();
}

function setConnectionStyle(styleType) {
  if (!selectedConnectionId) return;
  const eq = equipments.find((e) => e.id === selectedConnectionId);
  if (!eq) return;
  const styles = {
    ethernet: { type: "ethernet", color: "#007AFF", width: 2, dasharray: "" },
    radio: { type: "radio", color: "#007AFF", width: 2, dasharray: "5,5" },
    fiber: { type: "fiber", color: "#FFD700", width: 3, dasharray: "" }
  };
  eq.connectionStyle = styles[styleType];
  markAsUnsaved();
  saveState();
  render();
  closeConnectionMenu();
  showToast(`✅ Connexion modifiée : ${styleType === "ethernet" ? "Ethernet" : styleType === "radio" ? "Radio" : "Fibre"}`);
}

function deleteConnection() {
  if (!selectedConnectionId) return;
    const eq = equipments.find((e) => e.id === selectedConnectionId);
    if (eq) {
      eq.parent = null;
      delete eq.connectionStyle;
      markAsUnsaved();
      saveState();
      render();
      closeConnectionMenu();
      showToast("🔗 Connexion supprimée");
    }
}

/**
 * NOUVELLE FONCTION : Mettre en forme le lien sélectionné
 * Recalcule automatiquement les ports optimaux et génère des courbes propres
 */
function reformatConnection() {
  if (!selectedConnectionId) return;
  
  const childEq = equipments.find((e) => e.id === selectedConnectionId);
  if (!childEq || !childEq.parent) {
    showToast("❌ Aucune connexion valide à formater");
    return;
  }
  
  const parentEq = equipments.find((e) => e.id === childEq.parent);
  if (!parentEq) {
    showToast("❌ Parent introuvable");
    return;
  }
  
  // Compter les frères/sœurs (autres enfants du même parent)
  const siblings = equipments.filter(e => e.parent === childEq.parent && e.id !== childEq.id);
  const totalChildren = siblings.length + 1;
  
  // Trouver l'index de cet enfant parmi ses frères/sœurs (triés par position X)
  const allChildren = [...siblings, childEq].sort((a, b) => a.x - b.x);
  const childIndex = allChildren.findIndex(e => e.id === childEq.id);
  
  // Calculer les ports optimaux selon la position relative
  const { sourcePort, targetPort } = calculateOptimalPortsForReformat(parentEq, childEq, totalChildren, childIndex);
  
  // Appliquer les nouveaux ports
  childEq.sourcePort = sourcePort;
  childEq.targetPort = targetPort;
  
  // Générer des points de contrôle propres
  childEq.controlPoints = generateCleanControlPointsForReformat(parentEq, childEq);
  
  markAsUnsaved();
  saveState()
  render();
  closeConnectionMenu();
  showToast("✨ Connexion mise en forme avec succès !");
}

/**
 * Calcule les ports optimaux pour reformater une connexion existante
 */
function calculateOptimalPortsForReformat(parentNode, childNode, totalChildren, childIndex) {
  const nodeWidth = 160;
  const deltaX = childNode.x - parentNode.x;
  const deltaY = childNode.y - parentNode.y;
  
  let sourcePort, targetPort;
  
  // Analyser la position HORIZONTALE relative au parent
  const parentCenterX = parentNode.x + nodeWidth / 2;
  const childCenterX = childNode.x + nodeWidth / 2;
  const horizontalOffset = childCenterX - parentCenterX;
  
  // Seuils de zone
  const leftThreshold = -150;
  const rightThreshold = 150;
  
  // Enfant EN DESSOUS du parent (cas le plus fréquent)
  if (deltaY > 50) {
    // ZONE GAUCHE : Utiliser ports LEFT
    if (horizontalOffset < leftThreshold) {
      // Compter combien d'enfants sont déjà à gauche
      const leftSiblings = equipments.filter(e => {
        if (e.parent !== parentNode.id || e.id === childNode.id) return false;
        const offset = (e.x + nodeWidth/2) - parentCenterX;
        return offset < leftThreshold;
      });
      sourcePort = 15 + Math.min(4, leftSiblings.length); // LEFT 15-19
      targetPort = 7; // RIGHT de l'enfant
    }
    // ZONE DROITE : Utiliser ports RIGHT
    else if (horizontalOffset > rightThreshold) {
      const rightSiblings = equipments.filter(e => {
        if (e.parent !== parentNode.id || e.id === childNode.id) return false;
        const offset = (e.x + nodeWidth/2) - parentCenterX;
        return offset > rightThreshold;
      });
      sourcePort = 5 + Math.min(4, rightSiblings.length); // RIGHT 5-9
      targetPort = 17; // LEFT de l'enfant
    }
    // ZONE CENTRE : Utiliser ports BOTTOM
    else {
      const centerSiblings = equipments.filter(e => {
        if (e.parent !== parentNode.id || e.id === childNode.id) return false;
        const offset = (e.x + nodeWidth/2) - parentCenterX;
        return offset >= leftThreshold && offset <= rightThreshold;
      });
      sourcePort = 10 + Math.min(4, centerSiblings.length); // BOTTOM 10-14
      targetPort = 2; // TOP de l'enfant
    }
  }
  // Enfant À DROITE du parent
  else if (deltaX > Math.abs(deltaY)) {
    sourcePort = 7; // RIGHT du parent
    targetPort = 17; // LEFT de l'enfant
  }
  // Enfant À GAUCHE du parent
  else if (deltaX < -Math.abs(deltaY)) {
    sourcePort = 17; // LEFT du parent
    targetPort = 7; // RIGHT de l'enfant
  }
  // Enfant AU-DESSUS du parent
  else {
    sourcePort = 2; // TOP du parent
    targetPort = 12; // BOTTOM de l'enfant
  }
  
  return { sourcePort, targetPort };
}

/**
 * Génère des points de contrôle propres pour le reformatage
 * Crée des lignes droites en _|_ sans chevauchement
 */
/* CORRECTION DE LA LOGIQUE DE REFORMATAGE */
function generateCleanControlPointsForReformat(parentNode, childNode) {
  // On s'assure d'avoir des ports par défaut si indéfinis
  const srcPortIdx = childNode.sourcePort !== undefined ? childNode.sourcePort : 12;
  const tgtPortIdx = childNode.targetPort !== undefined ? childNode.targetPort : 2;

  const sourcePos = getPortPosition(parentNode, srcPortIdx);
  const targetPos = getPortPosition(childNode, tgtPortIdx);
  
  const deltaY = targetPos.y - sourcePos.y;
  const deltaX = targetPos.x - sourcePos.x;
  
  // BOTTOM (Ports 10 à 14) : Descente verticale puis horizontale
  if (srcPortIdx >= 10 && srcPortIdx <= 14) {
    // On descend de 60% de la distance ou au moins 40px
    const verticalDrop = Math.max(40, Math.abs(deltaY) * 0.5); 
    const midY = sourcePos.y + verticalDrop;
    
    return [
      { x: sourcePos.x, y: midY },      // Point 1 : Descend tout droit
      { x: targetPos.x, y: midY },      // Point 2 : Va à l'horizontale vers la cible
      { x: targetPos.x, y: targetPos.y } // Point 3 : Arrive à la cible
    ];
  }
  // RIGHT (Ports 5 à 9)
  else if (srcPortIdx >= 5 && srcPortIdx <= 9) {
    const horizontalOut = 60;
    const midY = sourcePos.y + (deltaY * 0.5);
    return [
      { x: sourcePos.x + horizontalOut, y: sourcePos.y },
      { x: sourcePos.x + horizontalOut, y: midY },
      { x: targetPos.x, y: targetPos.y }
    ];
  }
  // LEFT (Ports 15 à 19)
  else if (srcPortIdx >= 15 && srcPortIdx <= 19) {
    const horizontalOut = 60;
    const midY = sourcePos.y + (deltaY * 0.5);
    return [
      { x: sourcePos.x - horizontalOut, y: sourcePos.y },
      { x: sourcePos.x - horizontalOut, y: midY },
      { x: targetPos.x, y: targetPos.y }
    ];
  }
  // TOP (Ports 0 à 4)
  else {
    const midY = sourcePos.y - 60;
    return [
      { x: sourcePos.x, y: midY },
      { x: targetPos.x, y: midY },
      { x: targetPos.x, y: targetPos.y }
    ];
  }
}

/* ==========================================================================
   OUTILS UI (TOAST, DARK MODE, PHOTOS)
   ========================================================================== */
function showToast(msg) {
  const t = document.getElementById("toast");
  t.innerText = msg; t.style.opacity = 1;
  setTimeout(() => (t.style.opacity = 0), 3000);
}

function deselectAll() {
  document.querySelectorAll(".node").forEach((n) => n.classList.remove("selected"));
  selectedEquipmentId = null; updateFloatingButtons();
}

function updateFloatingButtons() {
  document.getElementById("photo-btn").classList.toggle("show", !!selectedEquipmentId);
}

function triggerPhotoUpload() { document.getElementById("photoInput").click(); }

function processPhoto(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.src = e.target.result;
      img.onload = function () {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = 800; canvas.height = img.height * (800 / img.width);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        if (selectedEquipmentId) {
          const eq = equipments.find((e) => e.id === selectedEquipmentId);
          eq.photo = canvas.toDataURL("image/jpeg", 0.7);
          markAsUnsaved(); render();
        }
      };
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function deleteThisEquipment(id, event) {
  event.stopPropagation();
  
  // On supprime directement sans demander
  equipments = equipments.filter(e => e.id !== id);
  equipments.forEach(e => { if (e.parent === id) e.parent = null; });
  
  saveState();
  render(); 
  markAsUnsaved();
  showToast("🗑️ Équipement supprimé"); // Petit feedback visuel sympa à la place
}

function openPhotoViewer(photoData) {
  document.getElementById("full-photo").src = photoData;
  document.getElementById("photo-modal-overlay").style.display = "flex";
}

function closePhotoViewer() {
  document.getElementById("photo-modal-overlay").style.display = "none";
}

function deleteCurrentPhoto() {
    if (selectedEquipmentId) {
      const eq = equipments.find((e) => e.id === selectedEquipmentId);
      if (eq && eq.photo) {
        delete eq.photo;
        markAsUnsaved();
        render();
        closePhotoViewer();
        showToast("Photo supprimée");
      }
    }
}

/* ==========================================================================
   NOUVEAU : GESTION DRAG & DROP POUR SÉLECTION (Delete & Multi)
   ========================================================================== */

function handleWorkspaceMouseDown(e) {
    // 1. Si on clique sur un équipement, une poignée ou un lien, on ne fait rien ici
    if (e.target.closest(".node") || e.target.closest("circle") || e.target.tagName === "path") return;

    // Calculs de position pour les sélections
    const container = document.getElementById("workspace-container");
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left) / currentZoom;
    const y = (e.clientY - rect.top) / currentZoom;

    // --- LOGIQUE DE DÉCISION ---
    
    if (isSelectionMode) {
        // Mode Suppression (Carré Rouge)
        startSelectionBox(x, y, "delete");
        e.preventDefault();
    } 
    else if (isMultiSelectMode) {
        // Mode Multi-Sélection (Carré Violet)
        startSelectionBox(x, y, "select");
        e.preventDefault();
    } 
    else {
        // --- MODE NORMAL (MAIN) ---
        // 1. On nettoie tout (désélection)
        deselectAll();
        if (typeof clearMultiSelection === 'function') clearMultiSelection();
        closeConnectionMenu();
        
        // 2. C'EST ICI QU'ON LANCE LE DÉPLACEMENT
        startPanning(e); 
    }
}

// Fonction générique pour démarrer le tracé de la boîte
function startSelectionBox(startX, startY, type) {
  const box = document.getElementById("selectionBox");
  
  // Config visuelle selon le type
  if (type === "delete") {
    box.style.backgroundColor = "rgba(255, 59, 48, 0.2)";
    box.style.borderColor = "#FF3B30";
    selectionStart = { x: startX, y: startY };
  } else {
    box.style.backgroundColor = "rgba(88, 86, 214, 0.2)";
    box.style.borderColor = "#5856D6";
    multiSelectStart = { x: startX, y: startY };
  }

  // Position initiale
  box.style.left = startX + "px";
  box.style.top = startY + "px";
  box.style.width = "0px";
  box.style.height = "0px";
  box.style.display = "block";

  // Ajouter les écouteurs pour le mouvement et le relâchement
  // On les ajoute sur 'document' pour ne pas perdre le focus si la souris sort de la div
  const onMouseMove = (e) => updateSelectionBox(e, startX, startY);
  
  const onMouseUp = (e) => {
    // 1. Nettoyage des écouteurs
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    
    // 2. IMPORTANT : Cacher la boîte visuelle TOUT DE SUITE
    // On le fait avant de lancer la suppression pour que le carré disparaisse
    // avant que la fenêtre "Confirmer la suppression ?" ne s'ouvre.
    const box = document.getElementById("selectionBox"); // Assurez-vous d'avoir accès à box ici
    box.style.display = "none"; 
    
    // 3. Calcul des coordonnées de fin
    const container = document.getElementById("workspace-container");
    const rect = container.getBoundingClientRect();
    const endX = (e.clientX - rect.left) / currentZoom;
    const endY = (e.clientY - rect.top) / currentZoom;

    // 4. Lancement de l'action
    if (type === "delete") {
      processBulkDelete({ x: startX, y: startY }, { x: endX, y: endY });
      
      // Désactiver le mode suppression automatiquement
      if (isSelectionMode) {
          toggleSelectionMode(); 
      }
      
    } else {
      processMultiSelect({ x: startX, y: startY }, { x: endX, y: endY });
    }
    
    // Réinitialisation des variables
    selectionStart = null;
    multiSelectStart = null;
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}

// Fonction qui met à jour la taille de la boîte pendant le drag
function updateSelectionBox(e, startX, startY) {
  const container = document.getElementById("workspace-container");
  const rect = container.getBoundingClientRect();
  const currentX = (e.clientX - rect.left) / currentZoom;
  const currentY = (e.clientY - rect.top) / currentZoom;

  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  const left = Math.min(currentX, startX);
  const top = Math.min(currentY, startY);

  const box = document.getElementById("selectionBox");
  box.style.width = width + "px";
  box.style.height = height + "px";
  box.style.left = left + "px";
  box.style.top = top + "px";
}

/* ==========================================================================
   EXPORT EXCEL
   ========================================================================== */
function exportToExcel() {
    // 1. Vérification
    if (!equipments || equipments.length === 0) {
        showToast("⚠️ Aucun équipement à exporter");
        return;
    }

    const siteName = document.getElementById("siteName").value || "Inventaire";

    // 2. Préparation des données
    // On clone et on trie pour avoir un Excel organisé (par type, puis par nom)
    const sortedEquipments = [...equipments].sort((a, b) => {
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        return a.deviceName.localeCompare(b.deviceName);
    });

    // 3. Mapping des colonnes demandées
    const data = sortedEquipments.map(eq => ({
        "Adresse IP": eq.ip || "",
        "Nom de l'équipement": eq.deviceName || "",
        "Localisation": eq.loc || "",
        "Mot de passe": "" // Colonne vide demandée
    }));

    // 4. Génération du fichier Excel
    // Création d'une feuille de calcul (Worksheet)
    const ws = XLSX.utils.json_to_sheet(data);

    // Ajustement automatique de la largeur des colonnes (Optionnel mais plus pro)
    const wscols = [
        {wch: 15}, // Largeur IP
        {wch: 25}, // Largeur Nom
        {wch: 25}, // Largeur Loc
        {wch: 20}  // Largeur Mdp
    ];
    ws['!cols'] = wscols;

    // Création du classeur (Workbook)
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventaire Réseau");

    // 5. Téléchargement
    try {
        XLSX.writeFile(wb, `${siteName}_Inventaire.xlsx`);
        showToast("✅ Export Excel réussi !");
    } catch (error) {
        console.error(error);
        showToast("❌ Erreur lors de l'export Excel");
    }
}

/* ==========================================================================
   GESTION DES POIGNÉES ORANGES (MODIFICATION DES LIENS)
   ========================================================================== */

// Variables pour le drag orange
let isDraggingOrange = false;
let draggedOrangeData = null;
let orangeTempLine = null;

function drawPortHandles(equipment, parentEquipment, svg) {
  // 1. Poignée Source (Côté Parent)
  // On utilise '|| 12' comme sécurité si le port n'est pas défini
  const sourcePos = getPortPosition(parentEquipment, equipment.sourcePort !== undefined ? equipment.sourcePort : 12);
  createHandleCircle(svg, sourcePos.x, sourcePos.y, equipment.id, "source");

  // 2. Poignée Cible (Côté Enfant)
  // On utilise '|| 2' comme sécurité
  const targetPos = getPortPosition(equipment, equipment.targetPort !== undefined ? equipment.targetPort : 2);
  createHandleCircle(svg, targetPos.x, targetPos.y, equipment.id, "target");
}

function createHandleCircle(svg, cx, cy, eqId, type) {
  const handle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  handle.setAttribute("cx", cx);
  handle.setAttribute("cy", cy);
  handle.setAttribute("r", 7); // Taille de la boule
  handle.setAttribute("fill", "#FF9500"); // Orange
  handle.setAttribute("stroke", "white");
  handle.setAttribute("stroke-width", 2);
  handle.style.cursor = "grab";
  handle.style.pointerEvents = "all"; 

  // C'est ici qu'on empêche le conflit avec le déplacement de l'objet
  handle.addEventListener("mousedown", (e) => {
    e.stopPropagation(); // STOP : Ne pas bouger l'équipement
    e.preventDefault();
    startDraggingPortHandle(eqId, type, e);
  });

  svg.appendChild(handle);
}

function startDraggingPortHandle(equipmentId, endType, e) {
  isDraggingOrange = true;
  draggedOrangeData = { equipmentId, endType };
  
  // Créer une ligne visuelle temporaire (Orange)
  const svg = document.getElementById("connections-layer");
  orangeTempLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  orangeTempLine.setAttribute("stroke", "#FF9500");
  orangeTempLine.setAttribute("stroke-width", "3");
  orangeTempLine.setAttribute("stroke-dasharray", "5,5");
  svg.appendChild(orangeTempLine);

  // On récupère les positions pour dessiner la ligne temporaire
  const eq = equipments.find(e => e.id === equipmentId);
  const parent = equipments.find(e => e.id === eq.parent);
  
  let fixedX, fixedY;
  
  // Si on bouge la source, le point fixe est la cible (et inversement)
  if (endType === "source") {
      const p = getPortPosition(eq, eq.targetPort !== undefined ? eq.targetPort : 2);
      fixedX = p.x; fixedY = p.y;
  } else {
      const p = getPortPosition(parent, eq.sourcePort !== undefined ? eq.sourcePort : 12);
      fixedX = p.x; fixedY = p.y;
  }
  
  orangeTempLine.setAttribute("x1", fixedX);
  orangeTempLine.setAttribute("y1", fixedY);
  orangeTempLine.setAttribute("x2", fixedX); // Suivra la souris
  orangeTempLine.setAttribute("y2", fixedY);

  document.addEventListener("mousemove", onOrangeMove);
  document.addEventListener("mouseup", onOrangeUp);
}

function onOrangeMove(e) {
  if (!isDraggingOrange || !orangeTempLine) return;
  
  const container = document.getElementById("workspace-container");
  const rect = container.getBoundingClientRect();
  const x = (e.clientX - rect.left) / currentZoom;
  const y = (e.clientY - rect.top) / currentZoom;
  
  orangeTempLine.setAttribute("x2", x);
  orangeTempLine.setAttribute("y2", y);
}

function onOrangeUp(e) {
  if (!isDraggingOrange) return;
  
  // Nettoyage
  if (orangeTempLine) orangeTempLine.remove();
  document.removeEventListener("mousemove", onOrangeMove);
  document.removeEventListener("mouseup", onOrangeUp);
  isDraggingOrange = false;

  // Détection du port sous la souris (Vert ou autre)
  const targetEl = document.elementFromPoint(e.clientX, e.clientY);
  
  if (targetEl && targetEl.classList.contains('port-dot')) {
      const targetEqId = targetEl.dataset.eqId;
      const targetPortIndex = parseInt(targetEl.dataset.portIndex);
      const eq = equipments.find(e => e.id === draggedOrangeData.equipmentId);

      // Logique de rebranchement
      if (draggedOrangeData.endType === "source") {
          // On change le PARENT (Source)
          if (targetEqId === eq.id) {
             // Protection : pas de boucle sur soi-même
             return; 
          }
          
          eq.parent = targetEqId;
          eq.sourcePort = targetPortIndex;
          showToast("🔗 Source modifiée !");
          
      } else {
          // On change la CIBLE (Target)
          // La cible DOIT rester sur le même équipement, on change juste de port
          if (targetEqId !== eq.id) {
             showToast("❌ L'extrémité cible doit rester sur le même équipement");
             return;
          }
          eq.targetPort = targetPortIndex;
          showToast("🎯 Cible déplacée !");
      }

      // Reset de la courbe bleue pour qu'elle se redessine proprement
      delete eq.controlPoints;
      
      saveState();
      render();
      markAsUnsaved();
  }
}

/* ==========================================================================
   AUTO SAVE (LOCAL STORAGE)
   ========================================================================== */
function saveToBrowser() {
    const data = JSON.stringify(equipments);
    const name = document.getElementById("siteName").value;
    
    localStorage.setItem("myConnectData", data);
    localStorage.setItem("myConnectName", name);
    
    // Petit indicateur visuel (optionnel)
    const status = document.getElementById("saveStatus");
    if(status) status.style.borderBottom = "2px solid #34C759"; // Souligne en vert
    setTimeout(() => { if(status) status.style.borderBottom = "none"; }, 500);
}

function clearBrowserSave() {
    localStorage.removeItem("myConnectData");
    localStorage.removeItem("myConnectName");
    location.reload(); // Recharge la page à zéro
}

/* ==========================================================================
   GESTION COPIER / COLLER (CTRL+C / CTRL+V)
   ========================================================================== */

// Variable globale pour stocker l'objet copié
let memoireTampon = null; 

document.addEventListener('keydown', function(e) {
    // 1. SÉCURITÉ : On ne fait rien si l'utilisateur écrit dans un champ texte
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;

    // --- CTRL + C (COPIER) ---
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        if (selectedEquipmentId) {
            const eq = equipments.find(item => item.id === selectedEquipmentId);
            
            if (eq) {
                e.preventDefault();
                // On copie les données dans la mémoire
                memoireTampon = {
                    type: eq.type,
                    deviceName: eq.deviceName + " (Copie)", // On ajoute "Copie" au nom
                    ip: eq.ip,
                    loc: eq.loc,
                    // Mettez 'null' ci-dessous si vous voulez que la copie soit détachée (sans fil)
                    parent: eq.parent, 
                    photo: eq.photo || null 
                };
                showToast("📋 Équipement copié !");
            }
        }
    }

    // --- CTRL + V (COLLER) ---
    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        if (memoireTampon) {
            e.preventDefault();

            // On calcule le centre de l'écran pour coller l'objet là où on regarde
            const wrapper = document.getElementById("workspace-wrapper");
            // wrapper.scrollLeft = position de la barre de défilement horizontale
            // + 300 = décalage pour être à peu près au milieu
            const centerX = (wrapper.scrollLeft + 300) / currentZoom; 
            const centerY = (wrapper.scrollTop + 300) / currentZoom;

            // Création de l'objet via votre fonction existante
            const newId = addSingleNode(
                memoireTampon.type,
                memoireTampon.deviceName,
                memoireTampon.ip,
                memoireTampon.loc,
                memoireTampon.parent, 
                centerX, // Position X calculée
                centerY  // Position Y calculée
            );

            // Gestion de la photo (car addSingleNode ne la gère pas par défaut)
            if (memoireTampon.photo) {
                const newEq = equipments.find(e => e.id === newId);
                if (newEq) {
                    newEq.photo = memoireTampon.photo;
                }
            }

            // Sauvegarde et affichage
            saveState();       
            render();          
            markAsUnsaved();   
            
            // On sélectionne automatiquement le nouvel objet
            deselectAll();
            selectedEquipmentId = newId;
            // On force un petit render pour afficher le cadre bleu de sélection
            setTimeout(render, 50); 
            
            showToast("📋 Élément collé !");
        }
    }
});