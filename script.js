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
let multiDragWaypoints = {};
let zones = []; // Stocke les rectangles de zone { id, x, y, width, height, label, color }
let labels = []; // <--- AJOUTER ICI
let selectedLabelId = null; // <--- NOUVELLE VARIABLE
let isDrawingZone = false;
let currentZone = null; // Zone en cours de tracé

const GRID_SIZE = 30; // Taille de la grille magnétique

/* ==========================================================================
   GESTION HISTORIQUE (UNDO / REDO)
   ========================================================================== */
const MAX_HISTORY = 50; // Nombre max d'actions mémorisées
let historyStack = [];
let historyStep = -1;

// Fonction pour sauvegarder l'état actuel
function saveState() {
    // 1. Si on est revenu en arrière, on coupe le futur (inchangé)
    if (historyStep < historyStack.length - 1) {
        historyStack = historyStack.slice(0, historyStep + 1);
    }

    // --- MODIFICATION ICI ---
    // On prépare un paquet complet avec Equipements ET Zones
    const fullData = {
        equipments: equipments,
        zones: zones,
        labels: labels // <--- AJOUTER ICI
    };

    // On transforme ce paquet en texte pour le stocker
    const state = JSON.stringify(fullData);
    // ------------------------

    historyStack.push(state);

    // 3. Limite de mémoire (inchangé)
    if (historyStack.length > MAX_HISTORY) {
        historyStack.shift();
    } else {
        historyStep++;
    }

    updateUndoRedoButtons();
    // Si vous avez une sauvegarde auto :
    if (typeof saveToBrowser === "function") saveToBrowser(); 
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

// Exemple de fonction à mettre à jour (peut s'appeler restoreState ou être dans undo())
function restoreState(stateStr) {
    const data = JSON.parse(stateStr);

    // VÉRIFICATION DE COMPATIBILITÉ
    if (Array.isArray(data)) {
        // C'est un ANCIEN format (juste des équipements)
        equipments = data;
        zones = []; // On vide les zones car il n'y en avait pas avant
    } else {
        // C'est le NOUVEAU format (objet complet)
        equipments = data.equipments || [];
        zones = data.zones || [];
        labels = data.labels || []; // <--- AJOUTER ICI
    }

    // On redessine tout
    render(); 
    // Si vous avez créé la fonction renderZones, appelez-la aussi :
    if (typeof renderZones === "function") renderZones();
    if (typeof renderLabels === "function") renderLabels(); // <--- AJOUTER ICI
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

// Variables pour le menu contextuel des points d'ancrage
let contextPointId = null;
let contextPointIndex = null;

// Variables pour le panning (déplacement de la vue)
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let initialScrollX = 0;
let initialScrollY = 0;

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
  
  // 1. COLLECTE SÉCURISÉE (Avec parseInt pour éviter les bugs String/Number)
  equipments.forEach(eq => {
    // Si c'est un enfant connecté à cet équipement (Source)
    if (eq.parent === equipmentId && eq.sourcePort !== undefined) {
      usedPorts.add(parseInt(eq.sourcePort));
    }
    // Si c'est l'équipement lui-même connecté à un parent (Target)
    if (eq.id === equipmentId && eq.targetPort !== undefined) {
      usedPorts.add(parseInt(eq.targetPort));
    }
  });
  
  // 2. ORDRE DE REMPLISSAGE ESTHÉTIQUE (Centre -> Extérieur)
  // Cela évite que tous les câbles partent du même côté.
  let portOrder = [];

  if (preferredSide === 'bottom') {
    // Ordre : Milieu (12), puis on alterne gauche/droite (11, 13, 10, 14)
    portOrder = [12, 11, 13, 10, 14, 2, 3, 1, 4, 0, 7, 17, 6, 18, 8, 16, 9, 15]; 
  } else if (preferredSide === 'top') {
    portOrder = [2, 1, 3, 0, 4, 12, 11, 13, 10, 14];
  } else {
    // Par défaut, on cherche partout
    portOrder = [12, 11, 13, 10, 14, 2, 1, 3, 0, 4, 7, 17, 6, 18, 5, 19];
  }
  
  // 3. RECHERCHE DU PREMIER LIBRE
  for (let port of portOrder) {
    if (!usedPorts.has(port)) {
      return port;
    }
  }
  
  // Secours : Si tout est plein, on renvoie le 12 (ça se superposera, mais c'est mieux que rien)
  return 12; 
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
          migrateControlPointsToWaypoints();
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

  // --- INITIALISATION MINIMAP ---
  // Met à jour la minimap quand on scrolle la zone de travail
  const wrapper = document.getElementById("workspace-wrapper");
  if (wrapper) {
      wrapper.addEventListener("scroll", () => {
          requestAnimationFrame(updateMinimap);
      });
  }

  // Premier dessin de la minimap après un court délai (le temps que tout se charge)
  setTimeout(updateMinimap, 500);

});

/* ==========================================================================
   MISE À JOUR STATUT (VERSION APPLE MONOCHROME)
   ========================================================================== */
function updateSaveStatus(saved) {
    const statusEl = document.getElementById("saveStatus");
    
    // On nettoie les classes d'état
    statusEl.classList.remove("unsaved"); 
    
    if (saved) {
        // CAS 1 : SAUVEGARDÉ
        // On remet le style par défaut (gris)
        // On change le HTML pour mettre le Nuage Validé
        statusEl.innerHTML = '<i class="bi bi-cloud-check"></i> <span class="status-text">Synchronisé</span>';
        
        hasUnsavedChanges = false;
        lastSaved = new Date();
    } else {
        // CAS 2 : NON SAUVEGARDÉ
        // On ajoute la classe pour foncer le texte
        statusEl.classList.add("unsaved");
        
        // On met le Nuage avec flèche (upload) ou points de suspension
        statusEl.innerHTML = '<i class="bi bi-cloud-arrow-up"></i> <span class="status-text">Modifié...</span>';
        
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

/** Migration rétrocompatible : convertit l'ancien controlPoints en waypoints */
function migrateControlPointsToWaypoints() {
  equipments.forEach(eq => {
    if (eq.controlPoints && !eq.waypoints) {
      eq.waypoints = eq.controlPoints;
      delete eq.controlPoints;
    }
  });
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
        migrateControlPointsToWaypoints();
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
    updateMinimap();
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

/* --- Smart Routing : Collision Detection Utilities --- */

/** Retourne les bounding boxes de tous les équipements sauf ceux exclus */
function getEquipmentBBoxes(excludeIds = []) {
  const MARGIN = 15;
  return equipments
    .filter(eq => !excludeIds.includes(eq.id))
    .map(eq => {
      const el = document.getElementById(eq.id);
      const h = el ? el.offsetHeight : 120;
      return { x: eq.x - MARGIN, y: eq.y - MARGIN, w: 160 + MARGIN * 2, h: h + MARGIN * 2 };
    });
}

/** Vérifie si un segment (p1->p2) intersecte un rectangle (box) */
function segmentIntersectsBox(p1, p2, box) {
  const bx2 = box.x + box.w, by2 = box.y + box.h;
  // Segment vertical
  if (Math.abs(p1.x - p2.x) < 1) {
    const x = p1.x;
    if (x < box.x || x > bx2) return false;
    const minY = Math.min(p1.y, p2.y), maxY = Math.max(p1.y, p2.y);
    return maxY > box.y && minY < by2;
  }
  // Segment horizontal
  if (Math.abs(p1.y - p2.y) < 1) {
    const y = p1.y;
    if (y < box.y || y > by2) return false;
    const minX = Math.min(p1.x, p2.x), maxX = Math.max(p1.x, p2.x);
    return maxX > box.x && minX < bx2;
  }
  // Segment diagonal : test par clipping (Liang-Barsky simplifié)
  let t0 = 0, t1 = 1;
  const dxx = p2.x - p1.x, dyy = p2.y - p1.y;
  const edges = [
    { p: -dxx, q: p1.x - box.x },
    { p: dxx,  q: bx2 - p1.x },
    { p: -dyy, q: p1.y - box.y },
    { p: dyy,  q: by2 - p1.y }
  ];
  for (const { p, q } of edges) {
    if (Math.abs(p) < 0.001) { if (q < 0) return false; }
    else {
      const r = q / p;
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
      else       { if (r < t0) return false; if (r < t1) t1 = r; }
    }
  }
  return t0 < t1;
}

/** Vérifie si un chemin complet (liste de points) traverse un obstacle */
function checkPathCollision(points, boxes) {
  for (let i = 0; i < points.length - 1; i++) {
    for (const box of boxes) {
      if (segmentIntersectsBox(points[i], points[i + 1], box)) return true;
    }
  }
  return false;
}

/** Cherche un Y intermédiaire sûr (sans collision horizontale) */
function findSafeY(startPos, endPos, boxes) {
  const idealMidY = (startPos.y + endPos.y) / 2;
  const minX = Math.min(startPos.x, endPos.x);
  const maxX = Math.max(startPos.x, endPos.x);
  const minBound = Math.min(startPos.y, endPos.y) + 20;
  const maxBound = Math.max(startPos.y, endPos.y) - 20;

  // Teste le midY idéal puis décale par pas de 20px
  for (let offset = 0; offset < 500; offset += 20) {
    for (const sign of [0, 1, -1]) {
      const testY = idealMidY + offset * sign;
      if (testY < minBound - 200 || testY > maxBound + 200) continue;
      const p1 = { x: minX, y: testY }, p2 = { x: maxX, y: testY };
      let collision = false;
      for (const box of boxes) {
        if (segmentIntersectsBox(p1, p2, box)) { collision = true; break; }
      }
      if (!collision) return testY;
    }
  }
  return idealMidY; // Fallback
}

/** Cherche un X intermédiaire sûr (sans collision verticale) */
function findSafeX(startPos, endPos, boxes) {
  const idealMidX = (startPos.x + endPos.x) / 2;
  const minY = Math.min(startPos.y, endPos.y);
  const maxY = Math.max(startPos.y, endPos.y);

  for (let offset = 0; offset < 500; offset += 20) {
    for (const sign of [0, 1, -1]) {
      const testX = idealMidX + offset * sign;
      const p1 = { x: testX, y: minY }, p2 = { x: testX, y: maxY };
      let collision = false;
      for (const box of boxes) {
        if (segmentIntersectsBox(p1, p2, box)) { collision = true; break; }
      }
      if (!collision) return testX;
    }
  }
  return idealMidX;
}

/**
 * Génère des waypoints avec routage intelligent (Smart Routing).
 * 1. Calcule un chemin orthogonal de base
 * 2. Vérifie les collisions avec les bounding boxes
 * 3. Si collision, cherche un chemin alternatif qui contourne les obstacles
 */
function generateSmartWaypoints(startPos, endPos, sourcePort, excludeIds = []) {
  const srcIdx = sourcePort !== undefined ? sourcePort : 12;
  const dx = endPos.x - startPos.x;
  const dy = endPos.y - startPos.y;
  const boxes = getEquipmentBBoxes(excludeIds);

  let waypoints;

  // --- Bundle Offset : décalage en V (escalier) pour séparer les câbles ---
  // Les câbles extrêmes descendent plus bas, le centre reste court → pas de croisement
  const BUNDLE_SPACING = 10;
  let bundleOffsetY = 0, bundleOffsetX = 0;
  if (srcIdx >= 10 && srcIdx <= 14) {
    bundleOffsetY = Math.abs(srcIdx - 12) * BUNDLE_SPACING;
  } else if (srcIdx >= 0 && srcIdx <= 4) {
    bundleOffsetY = Math.abs(srcIdx - 2) * BUNDLE_SPACING;
  } else if (srcIdx >= 5 && srcIdx <= 9) {
    bundleOffsetX = Math.abs(srcIdx - 7) * BUNDLE_SPACING;
  } else if (srcIdx >= 15 && srcIdx <= 19) {
    bundleOffsetX = Math.abs(srcIdx - 17) * BUNDLE_SPACING;
  }

  // --- Calcul du chemin orthogonal de base ---
  if (srcIdx >= 10 && srcIdx <= 14) {
    // BOTTOM : descente puis horizontal
    const midY = startPos.y + Math.max(40, Math.abs(dy) * 0.5) + bundleOffsetY;
    waypoints = [{ x: startPos.x, y: midY }, { x: endPos.x, y: midY }];
  } else if (srcIdx >= 0 && srcIdx <= 4) {
    // TOP : montée puis horizontal
    const midY = startPos.y - Math.max(40, Math.abs(dy) * 0.5) + bundleOffsetY;
    waypoints = [{ x: startPos.x, y: midY }, { x: endPos.x, y: midY }];
  } else if (srcIdx >= 5 && srcIdx <= 9) {
    // RIGHT : horizontal puis vertical
    const midX = startPos.x + Math.max(40, Math.abs(dx) * 0.5) + bundleOffsetX;
    waypoints = [{ x: midX, y: startPos.y }, { x: midX, y: endPos.y }];
  } else if (srcIdx >= 15 && srcIdx <= 19) {
    // LEFT : horizontal gauche puis vertical
    const midX = startPos.x - Math.max(40, Math.abs(dx) * 0.5) + bundleOffsetX;
    waypoints = [{ x: midX, y: startPos.y }, { x: midX, y: endPos.y }];
  } else {
    waypoints = [{ x: (startPos.x + endPos.x) / 2, y: (startPos.y + endPos.y) / 2 }];
  }

  // --- Vérification de collision ---
  if (boxes.length === 0) return waypoints;

  const fullPath = [startPos, ...waypoints, endPos];
  if (!checkPathCollision(fullPath, boxes)) return waypoints;

  // --- Collision détectée : chercher un chemin alternatif ---
  if (srcIdx >= 10 && srcIdx <= 14 || srcIdx >= 0 && srcIdx <= 4) {
    // Ports verticaux (BOTTOM/TOP) : chercher un midY sûr + bundle offset
    const safeY = findSafeY(startPos, endPos, boxes) + bundleOffsetY;
    waypoints = [{ x: startPos.x, y: safeY }, { x: endPos.x, y: safeY }];
    // Revérifier
    const newPath = [startPos, ...waypoints, endPos];
    if (!checkPathCollision(newPath, boxes)) return waypoints;

    // Toujours en collision : contournement en U (4 waypoints)
    // Trouver le côté le plus libre (gauche ou droite)
    const allBoxesMinX = Math.min(...boxes.map(b => b.x));
    const allBoxesMaxX = Math.max(...boxes.map(b => b.x + b.w));
    const goLeft = (startPos.x - allBoxesMinX) > (allBoxesMaxX - startPos.x);
    const detourX = goLeft ? allBoxesMinX - 40 : allBoxesMaxX + 40;
    return [
      { x: startPos.x, y: safeY },
      { x: detourX, y: safeY },
      { x: detourX, y: endPos.y },
      { x: endPos.x, y: endPos.y }
    ];
  } else {
    // Ports horizontaux (LEFT/RIGHT) : chercher un midX sûr + bundle offset
    const safeX = findSafeX(startPos, endPos, boxes) + bundleOffsetX;
    waypoints = [{ x: safeX, y: startPos.y }, { x: safeX, y: endPos.y }];
    const newPath = [startPos, ...waypoints, endPos];
    if (!checkPathCollision(newPath, boxes)) return waypoints;

    // Contournement en U vertical
    const allBoxesMinY = Math.min(...boxes.map(b => b.y));
    const allBoxesMaxY = Math.max(...boxes.map(b => b.y + b.h));
    const goUp = (startPos.y - allBoxesMinY) > (allBoxesMaxY - startPos.y);
    const detourY = goUp ? allBoxesMinY - 40 : allBoxesMaxY + 40;
    return [
      { x: safeX, y: startPos.y },
      { x: safeX, y: detourY },
      { x: endPos.x, y: detourY },
      { x: endPos.x, y: endPos.y }
    ];
  }
}

/**
 * Trouve l'index du segment le plus proche d'un point (x, y).
 * points = liste ordonnée [start, ...waypoints, end]
 * Retourne l'index i tel que le segment (points[i], points[i+1]) est le plus proche.
 */
function findClosestSegment(px, py, points) {
  let bestDist = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const ax = points[i].x, ay = points[i].y;
    const bx = points[i + 1].x, by = points[i + 1].y;
    const abx = bx - ax, aby = by - ay;
    const len2 = abx * abx + aby * aby;
    let t = len2 === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * abx, cy = ay + t * aby;
    const dist = Math.hypot(px - cx, py - cy);
    if (dist < bestDist) { bestDist = dist; bestIdx = i; }
  }
  return bestIdx;
}

/* ==========================================================================
   MISE À JOUR : FONCTION D'AFFICHAGE DES LIENS AVEC ÉTIQUETTES
   (Remplacez toute la fonction updateConnectionsOnly par celle-ci)
   ========================================================================== */
function updateConnectionsOnly() {
  const layer = document.getElementById("connections-layer");
  layer.innerHTML = ""; // On nettoie tout

  // On parcourt tous les équipements pour dessiner les liens vers leurs parents
  equipments.forEach((eq) => {
    if (eq.parent) {
      const parent = equipments.find((e) => e.id === eq.parent);
      if (parent) {
        
        // 1. Initialisation des ports (si pas encore fait)
        if (eq.sourcePort === undefined || eq.targetPort === undefined) {
          const preferredSide = determinePreferredSide(parent, eq.x, eq.y);
          eq.sourcePort = findFreePort(eq.parent, preferredSide);
          eq.targetPort = findFreePort(eq.id, preferredSide === 'bottom' ? 'top' : 'bottom');
        }
        
        // 2. Calcul des coordonnées
        const startPos = getPortPosition(parent, eq.sourcePort);
        const endPos = getPortPosition(eq, eq.targetPort);
        
        // 3. Génération ou récupération des points de passage (Waypoints)
        if (!eq.waypoints) {
          eq.waypoints = generateSmartWaypoints(startPos, endPos, eq.sourcePort, [eq.id, eq.parent]);
        }

        // 4. Construction du chemin SVG (Path Data)
        const wp = eq.waypoints;
        let pathData = `M ${startPos.x} ${startPos.y}`;
        wp.forEach(p => { pathData += ` L ${p.x} ${p.y}`; });
        pathData += ` L ${endPos.x} ${endPos.y}`;

        // 5. Style du lien
        const style = eq.connectionStyle || { color: "#007AFF", width: 2, dasharray: "" };

        // --- A. LE LIEN VISIBLE ---
        const visiblePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        visiblePath.setAttribute("d", pathData);
        visiblePath.setAttribute("stroke", style.color);
        visiblePath.setAttribute("stroke-width", style.width);
        if (style.dasharray) visiblePath.setAttribute("stroke-dasharray", style.dasharray);
        visiblePath.setAttribute("stroke-linejoin", "round");
        visiblePath.setAttribute("stroke-linecap", "round");
        visiblePath.setAttribute("fill", "none");
        visiblePath.style.pointerEvents = "none"; // Laisse passer les clics

        // --- B. LA ZONE DE CLIC (Invisible et épaisse) ---
        const hitAreaPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        hitAreaPath.setAttribute("d", pathData);
        hitAreaPath.setAttribute("stroke", "transparent");
        hitAreaPath.setAttribute("stroke-width", "20"); // Zone de clic confortable
        hitAreaPath.setAttribute("fill", "none");
        hitAreaPath.style.cursor = "pointer";
        hitAreaPath.style.pointerEvents = "stroke"; // Important pour détecter le clic

        // --- ÉVÉNEMENTS SUR LE LIEN ---
        
        // Clic Gauche : Sélectionner
        hitAreaPath.addEventListener("mousedown", (e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          
          // Logique de création de waypoint (Split segment)
          if (selectedConnectionId === eq.id && eq.waypoints) {
             const container = document.getElementById("workspace-container");
             const rect = container.getBoundingClientRect();
             const mx = (e.clientX - rect.left) / currentZoom;
             const my = (e.clientY - rect.top) / currentZoom;

             // Construire la liste complète des points du chemin
             const allPts = [{ x: startPos.x, y: startPos.y }, ...eq.waypoints, { x: endPos.x, y: endPos.y }];
             const segIdx = findClosestSegment(mx, my, allPts);

             const nearHandle = eq.waypoints.some(p => Math.hypot(p.x - mx, p.y - my) < 15);
             if (!nearHandle) {
                eq.waypoints.splice(segIdx, 0, { x: mx, y: my });
                updateConnectionsOnly();
                startDraggingHandle(eq.id, segIdx, e);
                return;
             }
          }
          selectConnection(eq.id, visiblePath, e);
        });

        // Clic Droit : Menu contextuel
        hitAreaPath.addEventListener("contextmenu", (e) => {
          e.preventDefault(); e.stopPropagation();
          selectConnection(eq.id, visiblePath, e);
          openConnectionMenu(e, eq.id);
        });

        // NOUVEAU : DOUBLE-CLIC POUR AJOUTER UNE ÉTIQUETTE
        hitAreaPath.addEventListener("dblclick", (e) => {
            e.stopPropagation(); e.preventDefault();
            const currentLabel = eq.connectionLabel || "";
            const newLabel = prompt("Texte de l'étiquette (ex: VLAN 10, 1Gbps) :", currentLabel);
            
            if (newLabel !== null) {
                eq.connectionLabel = newLabel;
                saveState();
                render(); // On redessine pour afficher l'étiquette
                showToast(newLabel ? "🏷️ Étiquette ajoutée" : "🗑️ Étiquette supprimée");
            }
        });

        layer.appendChild(hitAreaPath);
        layer.appendChild(visiblePath);

        // --- C. DESSIN DE L'ÉTIQUETTE (Si elle existe) ---
        if (eq.connectionLabel) {
            // Calculer le milieu du chemin pour poser l'étiquette
            // On prend tous les points : Start + Waypoints + End
            const allPoints = [startPos, ...wp, endPos];
            
            // On cherche le segment du milieu
            const middleIndex = Math.floor((allPoints.length - 1) / 2);
            const p1 = allPoints[middleIndex];
            const p2 = allPoints[middleIndex + 1];

            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            // Création du groupe SVG pour l'étiquette
            const labelGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
            labelGroup.style.cursor = "pointer";
            
            // Permettre de modifier en cliquant sur l'étiquette aussi
            labelGroup.addEventListener("dblclick", (e) => {
                e.stopPropagation();
                const newLabel = prompt("Modifier l'étiquette :", eq.connectionLabel);
                if (newLabel !== null) {
                    eq.connectionLabel = newLabel;
                    saveState();
                    render();
                }
            });

            // 1. Le fond blanc (Rectangle)
            const textBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            // Estimation grossière de la taille (sera ajustée dynamiquement si on avait du rendu texte complexe)
            const textWidth = eq.connectionLabel.length * 7 + 10; 
            textBg.setAttribute("x", midX - (textWidth / 2));
            textBg.setAttribute("y", midY - 10);
            textBg.setAttribute("width", textWidth);
            textBg.setAttribute("height", "20");
            textBg.setAttribute("rx", "4"); // Coins arrondis
            textBg.setAttribute("fill", "white");
            textBg.setAttribute("stroke", style.color); // Bordure de la même couleur que le lien
            textBg.setAttribute("stroke-width", "1");
            
            // 2. Le Texte
            const textEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
            textEl.setAttribute("x", midX);
            textEl.setAttribute("y", midY);
            textEl.setAttribute("dy", "4"); // Centrage vertical approximatif
            textEl.setAttribute("text-anchor", "middle"); // Centrage horizontal
            textEl.setAttribute("fill", "#333");
            textEl.setAttribute("font-size", "11px");
            textEl.setAttribute("font-family", "Arial, sans-serif");
            textEl.setAttribute("font-weight", "bold");
            textEl.textContent = eq.connectionLabel;

            labelGroup.appendChild(textBg);
            labelGroup.appendChild(textEl);
            layer.appendChild(labelGroup);
        }

        // --- D. GESTION DE LA SÉLECTION (POIGNÉES) ---
        if (selectedConnectionId === eq.id) {
          drawControlHandles(eq, layer); // Les points bleus de modification
          drawPortHandles(eq, parent, layer); // Les points oranges de re-connexion
        }
      }
    }

    // --- E. LIENS RADIO (Pointillés) ---
    // (Je garde votre code existant pour les liens radio PE/PR pour ne rien casser)
    if (eq.linkedTo && eq.id < eq.linkedTo) {
        const partner = equipments.find((e) => e.id === eq.linkedTo);
        if (partner) {
             // 1. Coordonnées de départ et d'arrivée
            const x1 = eq.x + 80;
            const y1 = eq.y + 60;
            const x2 = partner.x + 80;
            const y2 = partner.y + 60;

            // 2. Dessiner la ligne
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", `M ${x1} ${y1} L ${x2} ${y2}`);
            path.setAttribute("stroke", "#007AFF");
            path.setAttribute("stroke-width", "2");
            path.setAttribute("stroke-dasharray", "5,5");
            path.setAttribute("fill", "none");
            layer.appendChild(path);

            // 3. Étiquette Radio (automatique)
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            const numMatch = eq.deviceName.match(/\d+/);
            const linkNum = numMatch ? numMatch[0] : "?";
            const labelText = `LIEN ${linkNum}`;

            const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            const textWidth = 50; 
            const textHeight = 20;
            rect.setAttribute("x", midX - (textWidth / 2));
            rect.setAttribute("y", midY - (textHeight / 2));
            rect.setAttribute("width", textWidth);
            rect.setAttribute("height", textHeight);
            rect.setAttribute("fill", "white");
            rect.setAttribute("rx", "4");
            rect.setAttribute("stroke", "#007AFF");
            rect.setAttribute("stroke-width", "1");
            
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", midX);
            text.setAttribute("y", midY);
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("dominant-baseline", "middle");
            text.setAttribute("fill", "#007AFF");
            text.setAttribute("font-size", "10px");
            text.setAttribute("font-weight", "bold");
            text.setAttribute("font-family", "Arial");
            text.textContent = labelText;

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
  // Construire la liste complète des points : StartPoint -> Waypoints -> EndPoint
  const parent = equipments.find(e => e.id === equipment.parent);
  if (!parent) return;
  const startPos = getPortPosition(parent, equipment.sourcePort);
  const endPos = getPortPosition(equipment, equipment.targetPort);
  const allPts = [startPos, ...(equipment.waypoints || []), endPos];

  // Pour chaque segment (paire de points consécutifs), placer une poignée au milieu
  for (let i = 0; i < allPts.length - 1; i++) {
    const p1 = allPts[i];
    const p2 = allPts[i + 1];
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    // Déterminer l'orientation du segment
    const isHorizontal = Math.abs(p1.y - p2.y) < Math.abs(p1.x - p2.x);

    const handle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    handle.setAttribute("cx", midX);
    handle.setAttribute("cy", midY);
    handle.setAttribute("r", 5);
    handle.setAttribute("fill", "rgba(0, 122, 255, 0.5)");
    handle.setAttribute("stroke", "white");
    handle.setAttribute("stroke-width", 1.5);
    handle.style.cursor = isHorizontal ? "ns-resize" : "ew-resize";
    handle.style.pointerEvents = "all";
    handle.dataset.equipmentId = equipment.id;
    handle.dataset.segmentIndex = i;

    handle.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      startDraggingSegment(equipment.id, i, e);
    });

    svg.appendChild(handle);
  }

  // Dessiner des petites poignées sur chaque waypoint (coins) pour le clic droit "Supprimer"
  if (equipment.waypoints) {
    equipment.waypoints.forEach((wp, index) => {
      const wpHandle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      wpHandle.setAttribute("cx", wp.x);
      wpHandle.setAttribute("cy", wp.y);
      wpHandle.setAttribute("r", 4);
      wpHandle.setAttribute("fill", "rgba(0, 122, 255, 0.8)");
      wpHandle.setAttribute("stroke", "white");
      wpHandle.setAttribute("stroke-width", 1);
      wpHandle.style.cursor = "pointer";
      wpHandle.style.pointerEvents = "all";

      // Clic droit → menu contextuel pour supprimer ce point
      wpHandle.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        contextPointId = equipment.id;
        contextPointIndex = index;
        const menu = document.getElementById("pointContextMenu");
        menu.style.display = "block";
        menu.style.left = e.clientX + "px";
        menu.style.top = e.clientY + "px";
        setTimeout(() => document.addEventListener("click", closePointContextMenu, { once: true }), 50);
      });

      svg.appendChild(wpHandle);
    });
  }
}

function startDraggingHandle(equipmentId, handleIndex, e) {
  // Legacy — redirige vers startDraggingSegment pour compatibilité
  startDraggingSegment(equipmentId, handleIndex, e);
}

function startDraggingSegment(equipmentId, segmentIndex, e) {
  isDraggingHandle = true;
  draggedHandle = { equipmentId, segmentIndex };

  document.body.style.userSelect = 'none';
  e.preventDefault();

  const eq = equipments.find(eq => eq.id === equipmentId);
  if (!eq) return;

  // Construire la liste complète : StartPoint -> Waypoints -> EndPoint
  const parent = equipments.find(p => p.id === eq.parent);
  if (!parent) return;

  const getFullPoints = () => {
    const startPos = getPortPosition(parent, eq.sourcePort);
    const endPos = getPortPosition(eq, eq.targetPort);
    return [startPos, ...(eq.waypoints || []), endPos];
  };

  // Déterminer l'orientation initiale du segment
  const initialPts = getFullPoints();
  const p1 = initialPts[segmentIndex];
  const p2 = initialPts[segmentIndex + 1];
  const isHorizontal = Math.abs(p1.y - p2.y) < Math.abs(p1.x - p2.x);

  // Indices dans eq.waypoints : segmentIndex 0 = segment entre startPos et wp[0]
  // Les waypoints modifiables sont aux indices (segmentIndex - 1) et (segmentIndex) dans eq.waypoints
  // car allPts[0] = startPos, allPts[1] = wp[0], etc.
  const wpIdxA = segmentIndex - 1; // index dans eq.waypoints pour p1 (ou -1 si startPos)
  const wpIdxB = segmentIndex;     // index dans eq.waypoints pour p2 (ou eq.waypoints.length si endPos)
  const wpLen = (eq.waypoints || []).length;

  const onMouseMove = (moveEvent) => {
    if (!isDraggingHandle) return;
    moveEvent.preventDefault();

    const container = document.getElementById("workspace-container");
    const rect = container.getBoundingClientRect();
    const mouseX = (moveEvent.clientX - rect.left) / currentZoom;
    const mouseY = (moveEvent.clientY - rect.top) / currentZoom;

    if (!eq.waypoints) eq.waypoints = [];

    if (isHorizontal) {
      // Segment horizontal → on déplace sur Y uniquement
      // Modifier p1.y et p2.y (seulement si ce sont des waypoints, pas des ports)
      if (wpIdxA >= 0 && wpIdxA < wpLen) {
        eq.waypoints[wpIdxA].y = mouseY;
      }
      if (wpIdxB >= 0 && wpIdxB < wpLen) {
        eq.waypoints[wpIdxB].y = mouseY;
      }
    } else {
      // Segment vertical → on déplace sur X uniquement
      if (wpIdxA >= 0 && wpIdxA < wpLen) {
        eq.waypoints[wpIdxA].x = mouseX;
      }
      if (wpIdxB >= 0 && wpIdxB < wpLen) {
        eq.waypoints[wpIdxB].x = mouseX;
      }
    }

    updateConnectionsOnly();
    markAsUnsaved();
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
        delete eq.waypoints;
        
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
  updateMinimap();
  renderZones();  // Si vous avez les zones
  renderLabels(); // <--- AJOUTER ICI
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
    const relX = portPos.x - equipment.x;
    const relY = portPos.y - equipment.y;
    
    const portDot = document.createElement('div');
    portDot.className = 'port-dot';
    portDot.style.left = relX + 'px';
    portDot.style.top = relY + 'px';
    
    // Données vitales
    portDot.dataset.eqId = equipment.id;
    portDot.dataset.portIndex = i;

    // --- LE CORRECTIF EST ICI ---
    portDot.addEventListener("mousedown", (e) => {
        e.stopPropagation(); 
        e.preventDefault();

        // 1. CAS RECONNEXION (Ligne Orange active)
        if (typeof isReconnecting !== 'undefined' && isReconnecting) {
            console.log("🟠 Validation Reconnexion sur le port", i);
            applyReconnection(equipment.id, i);
            return; // On s'arrête là, on ne crée pas de nouveau lien
        }

        // 2. CAS CRÉATION NORMALE (Ligne Verte)
        startLinkCreation(equipment.id, i, e); 
    });
    
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
  // ============================================================
  // CORRECTIF ANTI-CONFLIT
  // Si on est déjà en mode "Reconnexion" (Câble orange en main),
  // on INTERDIT de démarrer une nouvelle création de lien.
  // ============================================================
  if (typeof isReconnecting !== 'undefined' && isReconnecting) return;

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

/* ==========================================================================
   GESTION DES LIENS FLUIDE (SANS CONFIRMATION)
   ========================================================================== */
function finishLinkCreation(sourceId, sourcePort, targetId, targetPort) {
    if (sourceId === targetId) return; // Pas de boucle sur soi-même

    const sourceEq = equipments.find(e => e.id === sourceId);
    const targetEq = equipments.find(e => e.id === targetId);

    if (!sourceEq || !targetEq) return;

    // --- SÉCURITÉ : GESTION DES PORTS OCCUPÉS ---

    // 1. Vérifier si le port SOURCE est déjà pris
    const occupierSource = getEquipmentOnPort(sourceId, sourcePort);
    if (occupierSource) {
        // Si c'est un autre équipement, on le débranche de ce port
        if (occupierSource.eq.id !== targetEq.id) {
            if (occupierSource.type === 'source') {
                // C'était un enfant branché ici, on le déconnecte du parent
                occupierSource.eq.parent = null;
                delete occupierSource.eq.sourcePort;
                delete occupierSource.eq.waypoints;
                showToast(`⚠️ Câble débranché de ${occupierSource.eq.deviceName} (Port occupé)`);
            }
        }
    }

    // 2. Vérifier si le port CIBLE est déjà pris
    const occupierTarget = getEquipmentOnPort(targetId, targetPort);
    if (occupierTarget) {
        // Si c'est déjà branché, on déconnecte l'ancien
        if (occupierTarget.eq.id !== sourceEq.id) {
            // C'était un parent branché ici
            // Comme targetEq (l'enfant) ne peut avoir qu'un seul parent, 
            // le simple fait de changer targetEq.parent plus bas va écraser l'ancien.
            // Donc pas besoin de code complexe ici, la suite gère le remplacement.
        }
    }

    // --- APPLICATION DE LA CONNEXION ---
    targetEq.parent = sourceId;
    targetEq.sourcePort = sourcePort;
    targetEq.targetPort = targetPort;
    
    // Tracé intelligent
    const startPos = getPortPosition(sourceEq, sourcePort);
    const endPos = getPortPosition(targetEq, targetPort);
    targetEq.waypoints = generateSmartWaypoints(startPos, endPos, sourcePort, [targetId, sourceId]);

    saveState();
    render();
    markAsUnsaved();
    showToast(`✅ Connecté sur ports ${sourcePort} → ${targetPort}`);
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
    multiDragWaypoints = {}; // Réinitialiser

    multiSelectedIds.forEach((id) => {
      const equipment = equipments.find((e) => e.id === id);
      if (equipment) {
        // 1. Sauver la position de l'objet
        multiDragInitialPositions[id] = { x: equipment.x, y: equipment.y };

        // 2. NEW : Sauver la position des points de contrôle (si le lien bouge aussi)
        // On ne le fait que si l'équipement a un parent qui est AUSSI sélectionné
        if (equipment.parent && multiSelectedIds.includes(equipment.parent) && equipment.waypoints) {
            // On fait une copie profonde du tableau pour ne pas modifier la référence
            multiDragWaypoints[id] = equipment.waypoints.map(p => ({ x: p.x, y: p.y }));
        }
      }
    });
  } else {
    multiDragInitialPositions = {};
    multiDragWaypoints = {};
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
        if (multiDragWaypoints[id]) {
            eq.waypoints = multiDragWaypoints[id].map(p => ({
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

    const newX = Math.max(0, snap(rawX));
    const newY = Math.max(0, snap(rawY));

    // Calcul du delta réel (après snap) pour mettre à jour les waypoints
    const dx = newX - eq.x;
    const dy = newY - eq.y;

    // CAS A : Si je déplace un PARENT → adapter les liens de ses enfants
    equipments.forEach((child) => {
      if (child.parent === activeDragId && child.waypoints && child.waypoints.length >= 2) {
        // wp[0] = point sous le parent, wp[1] = point au-dessus de l'enfant
        child.waypoints[0].x += dx;
        child.waypoints[0].y += dy;
        child.waypoints[1].y += dy;
        // wp[1].x ne bouge PAS : il reste aligné verticalement avec l'enfant
      }
    });

    // CAS B : Si je déplace un ENFANT → adapter son propre lien
    if (eq.parent && eq.waypoints && eq.waypoints.length >= 2) {
      // wp[1] = point au-dessus de l'enfant : suit le mouvement horizontal uniquement
      eq.waypoints[1].x += dx;
      // wp[1].y ne bouge PAS : la barre horizontale reste à la même hauteur
      // wp[0] ne bouge PAS : il reste accroché sous le parent
    }

    eq.x = newX;
    eq.y = newY;

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
  const locPE = document.getElementById("newLocation").value || "Lieu Appareil";
  const locPR = document.getElementById("newLocationPR").value || "Lieu Appareil";
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
    if (quantity > 5) quantity = 5;
    
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
    
    // --- SOUS-CAS 2C : GESTION MULTI-RANGÉES INTELLIGENTE ---
    // --- SOUS-CAS 2C : GESTION MULTI-RANGÉES (Connexion par le BAS) ---
    else {
      const presets = presetsByType[type];
      
      if (quantity > 1 && presets) {
        const equipData = getNextNEquipments(type, quantity);
        if (equipData.length === 0) {
          alert(`Plus de noms/IPs disponibles`);
          return;
        }

        const SPACING_X = 250;
        const NODE_WIDTH = 160;
        const n = equipData.length;

        // --- 1. DÉTECTION DE LA RANGÉE ET PLACEMENT ---
        const parentNode = parent ? equipments.find(e => e.id === parent) : null;
        let existingChildren = [];
        let startX = scrollX;
        let startY = scrollY;
        let isRow2 = false; // Est-ce une rangée supplémentaire ?

        if (parentNode) {
            existingChildren = equipments.filter(e => e.parent === parentNode.id);
            
            if (existingChildren.length > 0) {
                // RANGÉE 2+
                isRow2 = true;
                const maxY = Math.max(...existingChildren.map(e => e.y));
                startY = maxY + 250; // On descend d'un étage
                const totalRowWidth = (n - 1) * SPACING_X;
                startX = parentNode.x + NODE_WIDTH / 2 - totalRowWidth / 2;
            } else {
                // RANGÉE 1 (Standard)
                startY = parentNode.y + 250;
                const totalRowWidth = (n - 1) * SPACING_X;
                startX = parentNode.x + NODE_WIDTH / 2 - totalRowWidth / 2;
            }
            if (startX < 50) startX = 50;
        } else {
            equipments.forEach((eq) => {
                if (Math.abs(eq.x - startX) < 50 && Math.abs(eq.y - startY) < 50) {
                    startY += 100;
                }
            });
        }

        // --- 2. CRÉATION DES ENFANTS ---
        const newChildIds = [];
        equipData.forEach((data, index) => {
          const childX = startX + (index * SPACING_X);
          const childY = startY;
          const newId = "eq-" + Date.now() + Math.random().toString(36).substr(2, 5);

          // IMPORTANT : On force le port 12 (BAS) pour la rangée 2, sinon 2 (HAUT)
          const targetP = isRow2 ? 12 : 2;

          const eq = {
            id: newId, type: type, deviceName: data.name, ip: data.ip,
            loc: locPE, parent: parent, x: childX, y: childY,
            targetPort: targetP 
          };
          equipments.push(eq);
          newChildIds.push(newId);
        });

        // --- 3. CALCUL DES LIENS (ROUTAGE INTELLIGENT) ---
        if (parentNode) {
          const parentEl = document.getElementById(parentNode.id);
          const parentH = parentEl ? parentEl.offsetHeight : 120;
          
          // Tri visuel gauche -> droite
          const sortedChildren = newChildIds
            .map(id => equipments.find(e => e.id === id))
            .sort((a, b) => a.x - b.x);

          const centerIndex = (n - 1) / 2;

          // =========================================================
          // CAS A : RANGÉE 1 (Connexion Classique par le HAUT)
          // =========================================================
          if (!isRow2) {
              const assignedPorts = [10, 11, 12, 13, 14].slice(0, n);
              const parentBottomY = parentNode.y + parentH;
              const BASE_GAP = 30;
              const STEP_Y = 25;
              const maxDist = Math.floor(n / 2);

              sortedChildren.forEach((child, index) => {
                  const srcPort = assignedPorts[index] || 12;
                  child.sourcePort = srcPort;
                  const startPos = getPortPosition(parentNode, srcPort);
                  const endPos = getPortPosition(child, 2); // Haut

                  // Pyramide classique "V"
                  const distFromCenter = Math.abs(index - centerIndex);
                  const depthFactor = maxDist - distFromCenter; 
                  const levelY = parentBottomY + BASE_GAP + (depthFactor * STEP_Y);

                  child.waypoints = [{ x: startPos.x, y: levelY }, { x: endPos.x, y: levelY }];
              });
          } 
          
          // =========================================================
          // CAS B : RANGÉE 2+ (Connexion "Berceau" par le BAS)
          // =========================================================
          else {
              // On s'écarte très large pour contourner la rangée 1
              const existingCount = existingChildren.length || 5; 
              const safeFlankDist = (existingCount * SPACING_X) / 2 + 100; 
              const CABLE_LANE_SPACING = 20;

              sortedChildren.forEach((child, index) => {
                  const isLeft = index < n / 2;
                  const distFromCenter = Math.abs(index - centerIndex);
                  const maxDist = Math.floor(n / 2); // Distance max (bord)

                  // 1. PORTS SOURCE (Routeur)
                  // Gauche prend Gauche (19,18...), Droite prend Droite (5,6...)
                  let srcPort;
                  if (isLeft) {
                      srcPort = 19 - index; 
                      if(srcPort < 15) srcPort = 15;
                  } else {
                      srcPort = 5 + (index - Math.ceil(n/2)); 
                      if(srcPort > 9) srcPort = 9;
                  }
                  child.sourcePort = srcPort;

                  const startPos = getPortPosition(parentNode, srcPort);
                  const endPos = getPortPosition(child, 12); // <-- CONNEXION AU BAS (Port 12)
                  const parentCenterX = parentNode.x + NODE_WIDTH / 2;

                  // 2. COULOIR VERTICAL (Descente sur les flancs)
                  // L'extérieur (Bord) prend le couloir LARGE. L'intérieur (Centre) prend le couloir SERRÉ.
                  // Ainsi, le câble du centre passe "devant" avant de plonger.
                  const laneOffset = distFromCenter * CABLE_LANE_SPACING;
                  const flankX = isLeft 
                      ? (parentCenterX - safeFlankDist - laneOffset)
                      : (parentCenterX + safeFlankDist + laneOffset);

                  // 3. NIVEAU HORIZONTAL BAS (Sous la caméra)
                  // C'est ici que la magie opère :
                  // - Centre (dist 0) : Doit descendre TRÈS BAS pour passer sous les autres.
                  // - Bord (dist Max) : Doit descendre PEU (juste sous la caméra).
                  
                  const baseDepth = 40; // Espace minimum sous la caméra
                  const depthStep = 25; // Espace entre chaque fil superposé
                  
                  // Inversion de logique : Plus on est proche du centre (distFromCenter petit), plus on descend bas.
                  // Centre => Profondeur Max. Bord => Profondeur Min.
                  const extraDepth = (maxDist - distFromCenter) * depthStep;
                  const levelY = endPos.y + baseDepth + extraDepth;

                  // 4. WAYPOINTS (Le grand "U")
                  child.waypoints = [
                      { x: flankX, y: startPos.y },  // 1. Sortie latérale
                      { x: flankX, y: levelY },      // 2. Descente tout en bas (sous tout le monde)
                      { x: endPos.x, y: levelY }     // 3. Remontée vers le port du bas
                  ];
              });
          }
        }
        showToast(`${n} équipements ajoutés !`);
      } 
      // ... (Reste du code Ajout Unique inchangé) ...
      else {
          // --- CAS AJOUT UNIQUE (CORRIGÉ) ---
          let safeX = Math.max(50, scrollX);
          
          // 1. Création de l'équipement
          const newId = addSingleNode(type, deviceName, ip, locPE, parent, safeX, scrollY);
          
          // 2. Gestion intelligente de la connexion
          if (parent) {
            const child = equipments.find(e => e.id === newId);
            const parentNode = equipments.find(e => e.id === parent);
            
            if (child && parentNode) {
                // AU LIEU DE FORCER LE 12 : On cherche le premier port disponible en bas
                const freePort = findFreePort(parentNode.id, 'bottom');
                
                child.sourcePort = freePort; 
                child.targetPort = 2; // Arrivée sur le haut de l'enfant (standard)

                // On génère le tracé intelligent pour éviter les lignes droites moches
                const startPos = getPortPosition(parentNode, freePort);
                const endPos = getPortPosition(child, 2);
                
                // Utilisation du générateur de chemin qui évite les obstacles
                child.waypoints = generateSmartWaypoints(startPos, endPos, freePort, [child.id, parentNode.id]);
            }
          }
          showToast("Équipement ajouté !");
      }
    } // Fin de la fonction addEquipment
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
    // ALIGNEMENT VERTICAL STRICT
    // On garde le même X que le parent pour qu'il soit pile en dessous
    suggestedX = parentNode.x; 
    
    // On le place 200px plus bas (suffisant pour le lien)
    suggestedY = parentNode.y + 200; 
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
  // 1. Premier clic (Sélection du Parent/Source)
  if (!penFirstEquipment) {
    penFirstEquipment = equipmentId;
    const parentEq = equipments.find(e => e.id === equipmentId);
    
    // Feedback visuel
    showToast(`🔗 Source : ${parentEq.deviceName}. Cliquez sur la CIBLE.`);
    const parentNode = document.getElementById(equipmentId);
    if (parentNode) {
      parentNode.style.border = "3px solid #34C759"; // Bordure verte
      parentNode.style.boxShadow = "0 0 10px rgba(52, 199, 89, 0.5)";
    }
  } 
  // 2. Deuxième clic (Sélection de l'Enfant/Cible)
  else {
    const parentId = penFirstEquipment;
    const childId = equipmentId;

    // Nettoyage visuel du premier clic
    const parentNode = document.getElementById(parentId);
    if (parentNode) { 
        parentNode.style.border = ""; 
        parentNode.style.boxShadow = ""; 
    }
    penFirstEquipment = null; // On reset pour le prochain tour

    // Sécurités de base
    if (parentId === childId) {
      showToast("❌ Impossible de boucler sur soi-même");
      return;
    }

    const childEq = equipments.find(e => e.id === childId);
    const parentEq = equipments.find(e => e.id === parentId);

    if (childEq && parentEq) {
      // --- MODIFICATION : CONNEXION FORCÉE (PAS DE CONFIRMATION) ---
      
      // On connecte
      childEq.parent = parentId;
      
      // On cherche des ports libres intelligents
      // Parent: on cherche en bas (bottom), Enfant: on cherche en haut (top)
      const freeSourcePort = findFreePort(parentId, 'bottom');
      const freeTargetPort = findFreePort(childId, 'top');
      
      childEq.sourcePort = freeSourcePort;
      childEq.targetPort = freeTargetPort;
      
      // On calcule le chemin
      const startPos = getPortPosition(parentEq, freeSourcePort);
      const endPos = getPortPosition(childEq, freeTargetPort);
      childEq.waypoints = generateSmartWaypoints(startPos, endPos, freeSourcePort, [childId, parentId]);

      // Si pas de style, on met du bleu par défaut
      if (!childEq.connectionStyle) {
        childEq.connectionStyle = { type: "ethernet", color: "#007AFF", width: 2, dasharray: "" };
      }

      showToast(`✅ Lien créé !`);
      
      saveState();
      render();
      markAsUnsaved();
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
      if (eq.parent && eq.waypoints) {
          // On vérifie si UN des 3 points de contrôle est dans le carré rouge
          const isLinkSelected = eq.waypoints.some(p => 
              p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY
          );

          if (isLinkSelected) {
              // On coupe le lien !
              eq.parent = null;
              delete eq.sourcePort;
              delete eq.targetPort;
              delete eq.waypoints;
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
      const toolbar = document.getElementById("alignToolbar");
      if(toolbar) toolbar.style.display = "flex"; // <--- CETTE LIGNE EST IMPORTANTE
  }
}

function clearMultiSelection() {
  // 1. On vide la liste des IDs en mémoire
  multiSelectedIds = [];
  
  // 2. On retire le style visuel "sélectionné" de tous les équipements
  document.querySelectorAll(".node").forEach((node) => { 
      node.classList.remove("multi-selected"); 
  });

  // 3. IMPORTANT : On cache la barre d'outils d'alignement
  const toolbar = document.getElementById("alignToolbar");
  if (toolbar) {
      toolbar.style.display = "none";
  }

  // 4. Sécurité : on vide les variables de déplacement
  multiDragInitialPositions = {};
  multiDragWaypoints = {};
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

function closePointContextMenu() {
  document.getElementById("pointContextMenu").style.display = "none";
}

function deleteControlPoint() {
  if (contextPointId == null || contextPointIndex == null) return;
  const eq = equipments.find(e => e.id === contextPointId);
  if (!eq || !eq.waypoints || contextPointIndex >= eq.waypoints.length) return;

  eq.waypoints.splice(contextPointIndex, 1);
  closePointContextMenu();
  contextPointId = null;
  contextPointIndex = null;

  saveState();
  render();
  markAsUnsaved();
  showToast("Point supprimé");
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
  
  // Générer des waypoints orthogonaux propres
  const startPos = getPortPosition(parentEq, sourcePort);
  const endPos = getPortPosition(childEq, targetPort);
  childEq.waypoints = generateSmartWaypoints(startPos, endPos, sourcePort, [childEq.id, childEq.parent]);
  
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
   PANNING (DÉPLACEMENT DE LA VUE PAR CLIC GAUCHE SUR LE FOND)
   ========================================================================== */

function startPanning(e) {
  isPanning = true;

  // Utiliser la classe CSS .is-panning sur le wrapper (cursor: grabbing)
  const wrapper = document.getElementById("workspace-wrapper");
  wrapper.classList.add("is-panning");

  panStartX = e.clientX;
  panStartY = e.clientY;
  initialScrollX = wrapper.scrollLeft;
  initialScrollY = wrapper.scrollTop;

  document.addEventListener("mousemove", onPanning);
  document.addEventListener("mouseup", endPanning);
  // Arrêter aussi si la souris sort de la fenêtre
  document.addEventListener("mouseleave", endPanning);
}

function onPanning(e) {
  if (!isPanning) return;
  e.preventDefault();

  const dx = e.clientX - panStartX;
  const dy = e.clientY - panStartY;

  const wrapper = document.getElementById("workspace-wrapper");
  wrapper.scrollLeft = initialScrollX - dx;
  wrapper.scrollTop = initialScrollY - dy;
}

function endPanning() {
  if (!isPanning) return;
  isPanning = false;

  // Retirer la classe → le CSS repasse en cursor: grab automatiquement
  const wrapper = document.getElementById("workspace-wrapper");
  wrapper.classList.remove("is-panning");

  document.removeEventListener("mousemove", onPanning);
  document.removeEventListener("mouseup", endPanning);
  document.removeEventListener("mouseleave", endPanning);
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

/* ==========================================================================
   MODIFICATION : POIGNÉES ORANGES "JUMBO" (TRÈS GROSSES)
   ========================================================================== */
function createHandleCircle(svg, cx, cy, eqId, type) {
  const handle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  handle.setAttribute("cx", cx);
  handle.setAttribute("cy", cy);
  
  // 1. VISUEL : On passe de 8 à 12 (C'est gros !)
  handle.setAttribute("r", 12); 
  
  // 2. ZONE DE CLIC : On passe de 35 à 50 (Immense zone invisible)
  handle.setAttribute("fill", "#FF9500");
  handle.setAttribute("stroke", "transparent"); 
  handle.setAttribute("stroke-width", "50"); 
  
  // Style
  handle.style.paintOrder = "stroke"; 
  handle.style.cursor = "grab"; // Curseur "Main ouverte"
  handle.style.pointerEvents = "all"; 
  
  // Ombre pour mieux le voir (optionnel mais joli)
  handle.style.filter = "drop-shadow(0px 2px 2px rgba(0,0,0,0.3))";

  // Événement Clic
  handle.addEventListener("click", (e) => {
    e.stopPropagation(); 
    e.preventDefault();
    toggleReconnectionMode(eqId, type, cx, cy);
  });

  svg.appendChild(handle);
  
  // 3. CIBLE BLANCHE : Plus grosse aussi (4px)
  const center = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  center.setAttribute("cx", cx); 
  center.setAttribute("cy", cy);
  center.setAttribute("r", 4); 
  center.setAttribute("fill", "white");
  center.style.pointerEvents = "none";
  svg.appendChild(center);
}

/* ==========================================================================
   GESTION RECONNEXION (MODE "CLICK-CLICK")
   ========================================================================== */

let isReconnecting = false;
let reconnectionData = null; // Stocke { equipmentId, endType, fixedX, fixedY }
let reconnectionLine = null;

function toggleReconnectionMode(equipmentId, endType, handleX, handleY) {
    if (isReconnecting) { cancelReconnection(); return; }
    
    isReconnecting = true; // Active le mode
    
    // Récupération des infos
    const eq = equipments.find(e => e.id === equipmentId);
    const parent = equipments.find(e => e.id === eq.parent);
    
    let fixedX, fixedY;
    if (endType === "source") {
        // On bouge la source, donc la cible est fixe
        const p = getPortPosition(eq, eq.targetPort !== undefined ? eq.targetPort : 2);
        fixedX = p.x; fixedY = p.y;
    } else {
        // On bouge la cible, donc la source est fixe
        const p = getPortPosition(parent, eq.sourcePort !== undefined ? eq.sourcePort : 12);
        fixedX = p.x; fixedY = p.y;
    }

    reconnectionData = { equipmentId, endType, fixedX, fixedY };

    // Dessin de la ligne orange
    const svg = document.getElementById("connections-layer");
    reconnectionLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    reconnectionLine.setAttribute("x1", fixedX); reconnectionLine.setAttribute("y1", fixedY);
    reconnectionLine.setAttribute("x2", handleX); reconnectionLine.setAttribute("y2", handleY);
    reconnectionLine.setAttribute("stroke", "#FF9500");
    reconnectionLine.setAttribute("stroke-width", "3");
    reconnectionLine.setAttribute("stroke-dasharray", "5,5");
    
    // IMPORTANT : La ligne ne doit jamais bloquer la souris
    reconnectionLine.style.pointerEvents = "none"; 
    
    svg.appendChild(reconnectionLine);

    // Messages
    if (endType === "source") showToast("🔌 SOURCE : Cliquez sur un Switch");
    else showToast("🎯 CIBLE : Cliquez sur une Caméra");

    // On écoute juste le mouvement pour la ligne et le clavier pour annuler
    document.addEventListener("mousemove", onReconnectionMouseMove);
    document.addEventListener("keydown", onReconnectionKey);
    
    // AJOUT : Clic global pour ANNULER si on clique dans le vide
    document.addEventListener("mousedown", onGlobalCancelClick);
    
    document.body.style.cursor = "crosshair";
}

function onGlobalCancelClick(e) {
    // Si on clique sur un port ou une poignée, on laisse faire leurs propres écouteurs
    if (e.target.closest(".port-dot") || e.target.closest("circle")) return;
    
    // Sinon, on annule
    cancelReconnection();
}


function onReconnectionMouseMove(e) {
    if (!isReconnecting || !reconnectionLine) return;

    const container = document.getElementById("workspace-container");
    const rect = container.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / currentZoom;
    const mouseY = (e.clientY - rect.top) / currentZoom;

    // La ligne suit la souris
    reconnectionLine.setAttribute("x2", mouseX);
    reconnectionLine.setAttribute("y2", mouseY);
}

function onReconnectionClick(e) {
    if (!isReconnecting) return;

    // 1. ASTUCE SUPRÊME : On cache la ligne orange une milliseconde
    // pour être sûr que le 'elementFromPoint' voit le port vert dessous
    if (reconnectionLine) reconnectionLine.style.display = 'none';
    
    // 2. On regarde ce qu'il y a vraiment sous la souris
    let targetEl = document.elementFromPoint(e.clientX, e.clientY);
    
    // 3. On réaffiche la ligne immédiatement
    if (reconnectionLine) reconnectionLine.style.display = 'block';

    // 4. On vérifie si on a touché un port (ou le centre du port)
    // On utilise .closest() pour gérer le cas où on clique sur le petit point blanc au milieu
    let portEl = targetEl ? targetEl.closest(".port-dot") : null;

    if (portEl) {
        // C'EST GAGNÉ ! On récupère les infos du port vert
        const targetEqId = portEl.dataset.eqId;
        const targetPortIndex = parseInt(portEl.dataset.portIndex);
        
        console.log("🟢 Port vert détecté sur :", targetEqId, "Port:", targetPortIndex);
        
        // On stoppe tout autre événement
        e.stopPropagation();
        e.preventDefault();

        // On lance la validation
        applyReconnection(targetEqId, targetPortIndex);
        return;
    }

    // 5. Si on clique vraiment à côté (dans le vide), on annule
    // On vérifie qu'on ne clique pas sur un menu ou l'interface
    if (!e.target.closest(".floating-ui") && !e.target.closest(".context-menu")) {
        // Optionnel : Vous pouvez commenter cette ligne si vous trouvez l'annulation trop sensible
        cancelReconnection();
    }
}

function applyReconnection(targetEqId, targetPortIndex) {
    const oldChildId = String(reconnectionData.equipmentId);
    const newTargetId = String(targetEqId); // L'équipement cliqué
    
    const oldChild = equipments.find(e => String(e.id) === oldChildId);
    if (!oldChild) return;

    // --- CAS SOURCE (On change le parent) ---
    if (reconnectionData.endType === "source") {
        if (newTargetId === oldChildId) {
            showToast("❌ Impossible : C'est le même équipement.");
            return;
        }
        oldChild.parent = newTargetId;
        oldChild.sourcePort = targetPortIndex;
        delete oldChild.waypoints;
        showToast("✅ Parent modifié !");
    } 
    
    // --- CAS CIBLE (On change l'enfant/port) ---
    else {
        // Même équipement (Changement de port)
        if (newTargetId === oldChildId) {
            oldChild.targetPort = targetPortIndex;
            delete oldChild.waypoints;
            showToast("✅ Port modifié !");
        }
        // Transfert sur un autre équipement
        else {
            const newChild = equipments.find(e => String(e.id) === newTargetId);
            if (newChild.parent && !confirm(`Remplacer la connexion de ${newChild.deviceName} ?`)) {
                return;
            }
            // Transfert des données
            newChild.parent = oldChild.parent;
            newChild.sourcePort = oldChild.sourcePort;
            newChild.targetPort = targetPortIndex;
            delete newChild.waypoints;

            // Reset de l'ancien
            oldChild.parent = null;
            delete oldChild.sourcePort; delete oldChild.targetPort; delete oldChild.waypoints;
            
            showToast("✅ Câble déplacé !");
        }
    }

    saveState();
    render();
    markAsUnsaved();
    cleanupReconnection();
}

function cancelReconnection() {
    showToast("Annulation...");
    cleanupReconnection();
}

function cleanupReconnection() {
    isReconnecting = false;
    reconnectionData = null;
    
    if (reconnectionLine) {
        reconnectionLine.remove();
        reconnectionLine = null;
    }

    document.removeEventListener("mousemove", onReconnectionMouseMove);
    document.removeEventListener("keydown", onReconnectionKey);
    document.removeEventListener("mousedown", onGlobalCancelClick);
    document.body.style.cursor = "default";
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
   GESTION DE L'AIDE (MODALE)
   ========================================================================== */

function toggleHelp() {
    const modal = document.getElementById("helpModal");
    
    // Si elle est cachée (none) ou vide, on l'affiche (flex)
    if (modal.style.display === "none" || modal.style.display === "") {
        modal.style.display = "flex";
    } else {
        modal.style.display = "none";
    }
}

// Fonction bonus : Fermer si on clique sur le fond gris (l'overlay)
function closeHelpOnOutsideClick(e) {
    if (e.target.id === "helpModal") {
        toggleHelp();
    }
}

/* ==========================================================================
   GESTIONNAIRE CLAVIER UNIFIÉ (ECHAP, SUPPR, COPIER, COLLER)
   ========================================================================== */

// Variable pour le Copier/Coller
let memoireTampon = null; 

document.addEventListener('keydown', function(e) {
    
    // 1. SÉCURITÉ : On ignore si on écrit dans un champ texte
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;

    // console.log("Touche :", e.key); // Décommentez pour tester

    // ----------------------------------------------------------------------
    // A. TOUCHE ECHAP (Fermer fenêtres / Désélectionner)
    // ----------------------------------------------------------------------
    if (e.key === "Escape") {
        const helpModal = document.getElementById("helpModal");
        const addModal = document.getElementById("addModal");
        
        // Ferme les modales si elles sont ouvertes
        if (helpModal && helpModal.style.display === "flex") toggleHelp();
        if (addModal && addModal.style.display === "flex") closeAddModal();
        
        // Désélectionne tout
        deselectAll();
        if (typeof clearMultiSelection === 'function') clearMultiSelection();
    }

    // ----------------------------------------------------------------------
    // B. TOUCHE SUPPR / BACKSPACE (Supprimer sélection)
    // ----------------------------------------------------------------------
    if (e.key === "Delete" || e.key === "Backspace") {
        let itemsToDelete = [];

        // Cas 1 : Multi-sélection
        if (typeof multiSelectedIds !== 'undefined' && multiSelectedIds.length > 0) {
            itemsToDelete = [...multiSelectedIds];
        } 
        // Cas 2 : Sélection unique
        else if (selectedEquipmentId) {
            itemsToDelete = [selectedEquipmentId];
        }

        if (itemsToDelete.length > 0) {
            e.preventDefault(); 
            
            // On demande confirmation
            if (confirm(`Supprimer ${itemsToDelete.length} élément(s) ?`)) {
                
                // --- ETAPE 1 : NETTOYAGE VISUEL FORCÉ (C'est ça qui corrige votre bug) ---
                itemsToDelete.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.remove(); // On l'arrache du HTML directement
                });

                // --- ETAPE 2 : NETTOYAGE DES DONNÉES ---
                // On garde seulement ceux qui NE SONT PAS dans la liste à supprimer
                equipments = equipments.filter(eq => !itemsToDelete.includes(eq.id));
                
                // On nettoie les liens des orphelins (ceux qui étaient connectés aux objets supprimés)
                equipments.forEach(eq => {
                    if (itemsToDelete.includes(eq.parent)) {
                        eq.parent = null;
                        delete eq.connectionStyle;
                        delete eq.waypoints;
                        delete eq.sourcePort; // Important de nettoyer les ports aussi
                        delete eq.targetPort;
                    }
                    // Nettoyage inverse (si l'objet supprimé était un enfant)
                    if (itemsToDelete.includes(eq.id)) {
                         // Rien à faire ici car l'objet eq est déjà filtré au dessus
                    }
                });

                // --- ETAPE 3 : FINALISATION ---
                deselectAll();
                if (typeof clearMultiSelection === 'function') clearMultiSelection();
                
                // On force le redessin des liens (car les objets ont disparu, les traits doivent disparaitre aussi)
                updateConnectionsOnly(); 
                
                saveState();
                render(); // Redessine tout proprement pour être sûr
                markAsUnsaved();
                showToast("🗑️ Élément(s) supprimé(s)");
            }
        }
    }

    // ----------------------------------------------------------------------
    // C. CTRL + C (COPIER)
    // ----------------------------------------------------------------------
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        if (selectedEquipmentId) {
            const eq = equipments.find(item => item.id === selectedEquipmentId);
            if (eq) {
                e.preventDefault();
                memoireTampon = {
                    type: eq.type,
                    deviceName: eq.deviceName + " (Copie)",
                    ip: eq.ip,
                    loc: eq.loc,
                    parent: eq.parent, 
                    photo: eq.photo || null 
                };
                showToast("📋 Copié !");
            }
        }
    }

    // ----------------------------------------------------------------------
    // D. CTRL + V (COLLER)
    // ----------------------------------------------------------------------
    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        if (memoireTampon) {
            e.preventDefault();

            // Calcul du centre de l'écran
            const wrapper = document.getElementById("workspace-wrapper");
            const centerX = (wrapper.scrollLeft + 300) / currentZoom; 
            const centerY = (wrapper.scrollTop + 300) / currentZoom;

            // Création
            const newId = addSingleNode(
                memoireTampon.type,
                memoireTampon.deviceName,
                memoireTampon.ip,
                memoireTampon.loc,
                memoireTampon.parent, 
                centerX, 
                centerY 
            );

            // Gestion Photo
            if (memoireTampon.photo) {
                const newEq = equipments.find(e => e.id === newId);
                if (newEq) newEq.photo = memoireTampon.photo;
            }

            // Finalisation
            saveState();       
            render();          
            markAsUnsaved();   
            
            // Sélection du nouvel objet
            deselectAll();
            selectedEquipmentId = newId;
            setTimeout(render, 50); 
            
            showToast("📋 Collé !");
        }
    }
});

// --- PARTICULES BLEUES LOGIN ---
function createParticles() {
  const container = document.getElementById('particles-container');
  if (!container) return;
  
  const particleCount = 25;
  
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 12 + 's';
    particle.style.animationDuration = (8 + Math.random() * 8) + 's';
    const size = 3 + Math.random() * 5;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    container.appendChild(particle);
  }
}

createParticles();

/* ==========================================================================
   MENU CONTEXTUEL (CLIC DROIT SUR LE FOND)
   ========================================================================== */

// On écoute le clic droit sur la zone de travail
document.getElementById("workspace-container").addEventListener("contextmenu", function(e) {
    
    // 1. Si on clique sur un équipement ou un lien, on laisse le menu spécifique (ou rien)
    if (e.target.closest(".node") || e.target.tagName === "path" || e.target.closest("circle")) {
        return; // On ne fait rien, c'est géré ailleurs
    }

    // 2. On empêche le menu du navigateur
    e.preventDefault();

    // 3. Calcul de la position exacte dans le plan (pour créer l'objet au bon endroit)
    // On doit compenser le scroll et le zoom pour savoir où est la souris DANS le monde virtuel
    const container = document.getElementById("workspace-container");
    const rect = container.getBoundingClientRect();
    
    // Coordonnées relatives au canvas zoomé
    const rawX = e.clientX - rect.left; 
    const rawY = e.clientY - rect.top;

    // On stocke ces valeurs dans les variables globales que "addEquipment" utilise déjà
    suggestedX = rawX / currentZoom;
    suggestedY = rawY / currentZoom;

    // 4. Affichage du menu visuel (Positionné par rapport à l'écran)
    const menu = document.getElementById("workspaceContextMenu");
    menu.style.display = "block";
    menu.style.left = e.clientX + "px";
    menu.style.top = e.clientY + "px";

    // 5. Fermeture automatique si on clique ailleurs
    const closeMenu = () => {
        menu.style.display = "none";
        document.removeEventListener("click", closeMenu);
    };
    // Petit délai pour éviter que le clic droit ne ferme le menu immédiatement
    setTimeout(() => document.addEventListener("click", closeMenu), 50);
});

// Fonction déclenchée par le bouton "Ajouter ici"
function openAddModalFromContext() {
    // On ferme le menu contextuel
    document.getElementById("workspaceContextMenu").style.display = "none";

    // On ouvre la modale d'ajout classique
    openAddModal();

    // Feedback visuel (optionnel)
    console.log(`Préparation ajout en X:${Math.round(suggestedX)} Y:${Math.round(suggestedY)}`);
}

/* ==========================================================================
   GESTION GLOBALE DES CLICS (DÉPLACEMENT & SÉLECTION)
   ========================================================================== */
document.addEventListener("mousedown", function(e) {
    // 1. Seulement le clic gauche
    if (e.button !== 0) return;

    // 2. Ignorer les champs texte et modales
    if (e.target.closest("input") || e.target.closest("select") || e.target.closest(".modal-content")) return;

    // 3. Modes spéciaux prioritaires
    if (isDrawingZone || isPenMode) return;

    // 4. DÉTECTION : Sur quoi a-t-on cliqué ?
    const target = e.target;
    
    // Liste des choses qu'on NE VEUT PAS déplacer avec le fond
    const isObject = target.closest(".node") || 
                     target.closest(".port-dot") || 
                     target.closest(".resize-handle") || 
                     target.closest(".zone-controls") || 
                     target.closest("circle") || // Poignées SVG
                     target.tagName === "path" || // Lignes
                     target.closest(".floating-ui") ||
                     target.closest("#connectionMenu") || // <--- C'EST CETTE LIGNE QUI MANQUAIT !
                     target.closest(".context-menu") ||   // Pour les autres menus (clic droit fond)
                     target.closest(".workspace-label") || // Pour les post-its
                     target.closest("#minimap"); 

    // Si c'est un objet ou le menu, on arrête tout (pour laisser le clic passer)
    if (isObject || target.closest(".group-zone")) {
        return; 
    }

    // 5. Si on arrive ici, c'est le VIDE -> Panning ou Sélection
    if (isSelectionMode) {
        e.preventDefault();
        const rect = document.getElementById("workspace-container").getBoundingClientRect();
        const x = (e.clientX - rect.left) / currentZoom;
        const y = (e.clientY - rect.top) / currentZoom;
        startSelectionBox(x, y, "delete");
    }
    else if (isMultiSelectMode) {
        e.preventDefault();
        const rect = document.getElementById("workspace-container").getBoundingClientRect();
        const x = (e.clientX - rect.left) / currentZoom;
        const y = (e.clientY - rect.top) / currentZoom;
        startSelectionBox(x, y, "select");
    }
    else {
        // --- MODE PAR DÉFAUT : PANNING ---
        
        // On ne ferme les menus QUE si on clique vraiment dans le vide
        deselectAll();
        if (typeof clearMultiSelection === 'function') clearMultiSelection();
        closeConnectionMenu();
        if (typeof closePointContextMenu === 'function') closePointContextMenu();

        // === AJOUTER CECI : Désélectionner les notes ===
        if (selectedLabelId !== null) {
            selectedLabelId = null;
            renderLabels(); // On redessine pour enlever le rouge et les boutons
        }
        // ===============================================

        startPanning(e);
    }
});

function getEquipmentOnPort(equipmentId, portIndex) {
    // Cas 1 : Quelqu'un est branché sur ce port en tant que SOURCE (Switch -> Caméra)
    const asSource = equipments.find(eq => eq.parent === equipmentId && eq.sourcePort === portIndex);
    if (asSource) return { type: 'source', eq: asSource };

    // Cas 2 : Quelqu'un est branché sur ce port en tant que CIBLE (Caméra <- Switch)
    const asTarget = equipments.find(eq => eq.id === equipmentId && eq.targetPort === portIndex);
    if (asTarget) return { type: 'target', eq: asTarget };

    return null; // Le port est libre
}

/* ==========================================================================
   GESTION DE LA MINIMAP
   ========================================================================== */

function updateMinimap() {
    const minimap = document.getElementById("minimap");
    const content = document.getElementById("minimap-content");
    const viewport = document.getElementById("minimap-viewport");
    const wrapper = document.getElementById("workspace-wrapper");
    
    // Si pas d'équipements, on vide tout
    if (equipments.length === 0) {
        content.innerHTML = "";
        return;
    }

    // 1. Calculer les limites du MONDE RÉEL (Bounding Box des équipements)
    // On prend une marge de sécurité de 500px pour ne pas coller aux bords
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    equipments.forEach(eq => {
        if (eq.x < minX) minX = eq.x;
        if (eq.y < minY) minY = eq.y;
        if (eq.x > maxX) maxX = eq.x;
        if (eq.y > maxY) maxY = eq.y;
    });

    // On ajoute les marges virtuelles
    const padding = 200;
    const worldLeft = Math.min(0, minX - padding); // On commence au moins à 0
    const worldTop = Math.min(0, minY - padding);
    const worldRight = Math.max(wrapper.scrollWidth, maxX + padding + 200); // 200 = largeur node
    const worldBottom = Math.max(wrapper.scrollHeight, maxY + padding + 150);

    const worldWidth = worldRight - worldLeft;
    const worldHeight = worldBottom - worldTop;

    // 2. Calculer le RATIO (Échelle)
    // On veut faire tenir worldWidth dans 240px (largeur minimap)
    const mapW = minimap.offsetWidth;
    const mapH = minimap.offsetHeight;
    
    const scaleX = mapW / worldWidth;
    const scaleY = mapH / worldHeight;
    // On garde le ratio le plus petit pour que tout rentre sans déformation
    const scale = Math.min(scaleX, scaleY);

    // 3. Dessiner les POINTS (Équipements)
    content.innerHTML = ""; // Reset
    
    equipments.forEach(eq => {
        const dot = document.createElement("div");
        dot.className = "mini-node";
        if (eq.id === selectedEquipmentId) dot.classList.add("active");
        
        // Position sur la minimap
        const mx = (eq.x - worldLeft) * scale;
        const my = (eq.y - worldTop) * scale;
        
        dot.style.left = mx + "px";
        dot.style.top = my + "px";
        content.appendChild(dot);
    });

    // 4. Dessiner le VIEWPORT (Cadre Bleu)
    // C'est la zone actuellement visible à l'écran
    const visibleW = wrapper.clientWidth / currentZoom;
    const visibleH = wrapper.clientHeight / currentZoom;
    const scrollX = wrapper.scrollLeft / currentZoom; // Attention : wrapper.scrollLeft n'est pas affecté par le zoom CSS transform
    // Correction pour le scroll : sur un container transformé scale(), le scrollLeft est en pixels bruts
    
    // Position du cadre
    const vx = (wrapper.scrollLeft - worldLeft) * scale; // Approximation simple
    const vy = (wrapper.scrollTop - worldTop) * scale;
    const vw = (wrapper.clientWidth / currentZoom) * scale; // Largeur visible mise à l'échelle
    const vh = (wrapper.clientHeight / currentZoom) * scale;

    viewport.style.left = vx + "px";
    viewport.style.top = vy + "px";
    viewport.style.width = vw + "px";
    viewport.style.height = vh + "px";

    // 5. RENDRE LA MINIMAP CLIQUABLE (Navigation Rapide)
    minimap.onclick = function(e) {
        const rect = minimap.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // On convertit le clic minimap -> coordonnées monde réel
        // On veut centrer la vue sur le clic
        const targetX = (clickX / scale) + worldLeft - (visibleW / 2);
        const targetY = (clickY / scale) + worldTop - (visibleH / 2);

        wrapper.scrollLeft = targetX;
        wrapper.scrollTop = targetY;
        
        // On met à jour le visuel immédiatement
        updateMinimap();
    };
}

/* ==========================================================================
   LOGIQUE SPOTLIGHT (RECHERCHE RAPIDE)
   ========================================================================== */

// 1. Écouteur global pour le raccourci CTRL+K ou CMD+K
document.addEventListener("keydown", function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault(); // Empêcher le comportement par défaut du navigateur
        toggleSpotlight();
    }
    // Fermer avec ESC
    if (e.key === "Escape") {
        closeSpotlight();
    }
});

// 2. Ouvrir / Fermer
function toggleSpotlight() {
    const overlay = document.getElementById("spotlight-overlay");
    const input = document.getElementById("spotlight-input");
    
    if (overlay.classList.contains("visible")) {
        closeSpotlight();
    } else {
        overlay.classList.remove("hidden");
        // Petit délai pour l'animation CSS
        setTimeout(() => overlay.classList.add("visible"), 10);
        input.value = "";
        renderSearchResults(""); // Afficher tout ou rien au début
        setTimeout(() => input.focus(), 50); // Focus automatique
    }
}

function closeSpotlight(e) {
    // Si e est défini (clic), on vérifie qu'on clique sur le fond gris, pas la boîte
    if (e && e.target.closest(".spotlight-container")) return;

    const overlay = document.getElementById("spotlight-overlay");
    overlay.classList.remove("visible");
    setTimeout(() => overlay.classList.add("hidden"), 200);
}

// 3. Filtrage en temps réel
document.getElementById("spotlight-input").addEventListener("input", function(e) {
    renderSearchResults(e.target.value);
});

function renderSearchResults(query) {
    const list = document.getElementById("spotlight-results");
    list.innerHTML = "";
    
    if (!query) return; // Si vide, on n'affiche rien (ou afficher les récents ?)

    const lowerQuery = query.toLowerCase();

    // Filtrer les équipements
    const matches = equipments.filter(eq => {
        return (eq.deviceName && eq.deviceName.toLowerCase().includes(lowerQuery)) || 
               (eq.ip && eq.ip.includes(lowerQuery)) ||
               (eq.type && eq.type.includes(lowerQuery));
    });

    if (matches.length === 0) {
        list.innerHTML = `<div style="padding:15px; text-align:center; color:#999;">Aucun résultat</div>`;
        return;
    }

    // Générer le HTML
    matches.forEach(eq => {
        const div = document.createElement("div");
        div.className = "search-result-item";
        div.innerHTML = `
            <div class="result-icon">${getIcon(eq.type)}</div>
            <div class="result-info">
                <span class="result-name">${eq.deviceName}</span>
                <span class="result-ip">${eq.ip || "Pas d'IP"}</span>
            </div>
        `;
        
        // Clic sur un résultat
        div.addEventListener("click", () => {
            focusOnEquipment(eq.id);
            closeSpotlight();
        });

        list.appendChild(div);
    });
}

// 4. Fonction "Téléportation" (Zoom & Centre)
function focusOnEquipment(id) {
    const eq = equipments.find(e => e.id === id);
    if (!eq) return;

    // A. Sélectionner l'objet visuellement
    deselectAll();
    selectedEquipmentId = id;
    render(); // Pour mettre la bordure verte/bleue
    
    // B. Calculer la position pour centrer l'écran
    const wrapper = document.getElementById("workspace-wrapper");
    const containerW = wrapper.clientWidth;
    const containerH = wrapper.clientHeight;

    // On veut que l'équipement soit au centre
    // Formule : (PositionX * Zoom) - (MoitiéEcran) + (MoitiéObjet * Zoom)
    const targetScrollX = (eq.x * currentZoom) - (containerW / 2) + (80 * currentZoom); // 80 = demi-largeur
    const targetScrollY = (eq.y * currentZoom) - (containerH / 2) + (60 * currentZoom); // 60 = demi-hauteur

    // C. Animation fluide du scroll
    wrapper.scrollTo({
        left: targetScrollX,
        top: targetScrollY,
        behavior: 'smooth'
    });

    // D. Feedback visuel (Optionnel : petit flash)
    setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
            el.style.transition = "transform 0.2s";
            el.style.transform = "scale(1.2)";
            setTimeout(() => el.style.transform = "scale(1)", 200);
        }
    }, 300);
}

/* ==========================================================================
   GESTION DES ZONES (GROUPES VISUELS)
   ========================================================================== */

function toggleZoneMode() {
    isDrawingZone = !isDrawingZone;
    const btn = document.querySelector("button[onclick='toggleZoneMode()']");
    
    if (isDrawingZone) {
        document.body.classList.add("zone-mode");
        if(btn) btn.classList.add("active");
        showToast("📐 Mode Zone : Cliquez et glissez pour dessiner");
        
        // Désactiver les autres modes
        isSelectionMode = false; isPenMode = false; isMultiSelectMode = false;
        deselectAll();
    } else {
        document.body.classList.remove("zone-mode");
        if(btn) btn.classList.remove("active");
    }
}

// Ajouter ces écouteurs globaux pour le dessin
// (Vous pouvez les fusionner avec vos écouteurs existants si vous êtes à l'aise, sinon ajoutez-les)
document.getElementById("workspace-container").addEventListener("mousedown", startZoneDraw);
document.addEventListener("mousemove", moveZoneDraw);
document.addEventListener("mouseup", endZoneDraw);

function startZoneDraw(e) {
    if (!isDrawingZone) return;
    if (e.target.closest(".node") || e.target.closest(".group-zone")) return; // Pas sur un objet

    const rect = document.getElementById("workspace-container").getBoundingClientRect();
    const x = (e.clientX - rect.left) / currentZoom;
    const y = (e.clientY - rect.top) / currentZoom;

    // Création de la zone temporaire
    currentZone = {
        id: "zone-" + Date.now(),
        x: x, y: y, width: 0, height: 0,
        label: "Nouvelle Zone",
        color: "#ccc"
    };
    
    e.preventDefault(); // Empêche la sélection de texte
}

function moveZoneDraw(e) {
    if (!isDrawingZone || !currentZone) return;

    const rect = document.getElementById("workspace-container").getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / currentZoom;
    const currentY = (e.clientY - rect.top) / currentZoom;

    // Calcul largeur/hauteur (gère le tracé dans tous les sens)
    const width = currentX - currentZone.x;
    const height = currentY - currentZone.y;
    
    // Mise à jour visuelle (création d'un div temporaire si pas encore fait)
    let el = document.getElementById("temp-zone-draw");
    if (!el) {
        el = document.createElement("div");
        el.id = "temp-zone-draw";
        el.style.position = "absolute";
        el.style.border = "2px dashed #007AFF";
        el.style.backgroundColor = "rgba(0, 122, 255, 0.1)";
        document.getElementById("workspace-container").appendChild(el);
    }

    el.style.left = (width > 0 ? currentZone.x : currentX) + "px";
    el.style.top = (height > 0 ? currentZone.y : currentY) + "px";
    el.style.width = Math.abs(width) + "px";
    el.style.height = Math.abs(height) + "px";
}

function endZoneDraw(e) {
    if (!isDrawingZone || !currentZone) return;

    // Récupérer le div temporaire pour avoir les dims finales exactes
    const el = document.getElementById("temp-zone-draw");
    if (el) {
        // Sauvegarder la zone
        const finalX = parseFloat(el.style.left);
        const finalY = parseFloat(el.style.top);
        const finalW = parseFloat(el.style.width);
        const finalH = parseFloat(el.style.height);

        // On ignore les zones minuscules (clics accidentels)
        if (finalW > 50 && finalH > 50) {
            zones.push({
                id: currentZone.id,
                x: finalX, y: finalY,
                width: finalW, height: finalH,
                label: "Zone " + (zones.length + 1)
            });
            saveState();
        }
        
        el.remove(); // Nettoyage
    }

    currentZone = null;
    toggleZoneMode(); // On quitte le mode après un tracé (ou pas, selon votre goût)
    renderZones(); // Fonction à créer ci-dessous
}

// Fonction d'affichage des zones (à appeler dans render())
// Fonction d'affichage des zones avec sélecteur de couleur
/* ==========================================================================
   MISE À JOUR : FONCTION D'AFFICHAGE DES ZONES AVEC COULEUR
   (Remplacer l'ancienne fonction renderZones par celle-ci)
   ========================================================================== */
function renderZones() {
    // 1. Nettoyer les anciennes zones visuelles
    document.querySelectorAll(".group-zone").forEach(el => el.remove());

    const container = document.getElementById("workspace-container");

    // Utilitaire pour gérer la transparence du fond
    const hexToRgba = (hex, alpha) => {
        if (!hex) return `rgba(0, 0, 0, ${alpha})`;
        let r = parseInt(hex.slice(1, 3), 16),
            g = parseInt(hex.slice(3, 5), 16),
            b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    zones.forEach(zone => {
        const el = document.createElement("div");
        el.className = "group-zone";
        el.id = zone.id;
        el.style.left = zone.x + "px";
        el.style.top = zone.y + "px";
        el.style.width = zone.width + "px";
        el.style.height = zone.height + "px";

        // --- APPLICATION DE LA COULEUR ---
        const baseColor = zone.color || "#cccccc";
        el.style.borderColor = baseColor;
        el.style.backgroundColor = hexToRgba(baseColor, 0.05); // Fond très transparent
        if (zone.color) el.style.borderStyle = "solid"; // Bordure continue si couleur choisie

        // --- LABEL (TITRE) ---
        const label = document.createElement("input");
        label.type = "text";
        label.className = "zone-label";
        label.value = zone.label;
        label.style.color = baseColor !== "#cccccc" ? baseColor : "#666"; 
        label.onchange = (e) => { zone.label = e.target.value; saveState(); };
        el.appendChild(label);

        // --- BARRE D'OUTILS (COULEUR + SUPPRIMER) ---
        const controls = document.createElement("div");
        controls.className = "zone-controls";

        // 1. INPUT COULEUR
        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.className = "zone-btn input-color-zone";
        colorInput.value = zone.color || "#cccccc";
        colorInput.title = "Changer la couleur";
        
        // Changement en direct (Aperçu)
        colorInput.oninput = (e) => {
            const c = e.target.value;
            el.style.borderColor = c;
            el.style.borderStyle = "solid";
            el.style.backgroundColor = hexToRgba(c, 0.1); 
            label.style.color = c;
        };
        // Validation finale (Sauvegarde)
        colorInput.onchange = (e) => {
            zone.color = e.target.value;
            saveState();
        };
        controls.appendChild(colorInput);

        // 2. BOUTON SUPPRIMER
        const delBtn = document.createElement("button");
        delBtn.className = "zone-btn btn-delete-zone";
        delBtn.innerHTML = "×";
        delBtn.title = "Supprimer la zone";
        delBtn.onclick = (e) => { 
            e.stopPropagation();
            if(confirm(`Supprimer la zone "${zone.label}" ?`)) {
                zones = zones.filter(z => z.id !== zone.id);
                renderZones();
                saveState();
            }
        };
        controls.appendChild(delBtn);

        el.appendChild(controls);

        // --- REDIMENSIONNEMENT ---
        const resizeHandle = document.createElement("div");
        resizeHandle.className = "resize-handle";
        resizeHandle.onmousedown = (e) => initResizeZone(e, zone); 
        el.appendChild(resizeHandle);

        // Insertion dans le DOM (derrière les autres éléments)
        container.insertBefore(el, container.firstChild);
    });
}

/* ==========================================================================
   LOGIQUE DE REDIMENSIONNEMENT DES ZONES
   (Permet d'agrandir et rétrécir via la poignée bleue)
   ========================================================================== */
function initResizeZone(e, zone) {
    e.stopPropagation(); // Empêche de bouger la carte en même temps
    e.preventDefault();

    // 1. On mémorise la position de départ de la souris et de la zone
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = zone.width;
    const startHeight = zone.height;

    // 2. Fonction qui s'exécute quand on BOUGE la souris
    const doResize = (ev) => {
        // Calcul du déplacement (Delta) corrigé par le ZOOM
        // C'est très important de diviser par currentZoom sinon le redimensionnement sera décalé
        const dx = (ev.clientX - startX) / currentZoom;
        const dy = (ev.clientY - startY) / currentZoom;

        // Nouvelle taille (avec un minimum de 50px pour ne pas disparaître)
        zone.width = Math.max(50, startWidth + dx);
        zone.height = Math.max(50, startHeight + dy);

        // On met à jour l'affichage en direct pour voir le résultat
        renderZones();
    };

    // 3. Fonction qui s'exécute quand on LÂCHE le clic
    const stopResize = () => {
        window.removeEventListener('mousemove', doResize);
        window.removeEventListener('mouseup', stopResize);
        saveState(); // On sauvegarde la nouvelle taille une fois fini
    };

    // On écoute les mouvements sur toute la fenêtre (et pas juste sur la zone)
    // pour éviter de "perdre" la poignée si on bouge la souris trop vite
    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResize);
}

/* ==========================================================================
   FONCTIONS D'ALIGNEMENT ET DISTRIBUTION
   ========================================================================== */

function alignSelected(mode) {
    if (multiSelectedIds.length < 2) return;

    // 1. Récupérer les objets sélectionnés
    const items = equipments.filter(eq => multiSelectedIds.includes(eq.id));
    
    // 2. Trouver les limites (Bounding Box globale)
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    items.forEach(eq => {
        if (eq.x < minX) minX = eq.x;
        if (eq.x > maxX) maxX = eq.x;
        if (eq.y < minY) minY = eq.y;
        if (eq.y > maxY) maxY = eq.y;
    });

    // 3. Appliquer l'alignement
    items.forEach(eq => {
        switch(mode) {
            case 'left':   eq.x = minX; break;
            case 'center': eq.x = minX + (maxX - minX)/2; break; // Centre vertical (alignés sur une colonne)
            case 'right':  eq.x = maxX; break;
            
            case 'top':    eq.y = minY; break;
            case 'middle': eq.y = minY + (maxY - minY)/2; break; // Centre horizontal (alignés sur une ligne)
            case 'bottom': eq.y = maxY; break;
        }
    });

    finalizeAlignment();
}

function distributeSelected(axis) {
    if (multiSelectedIds.length < 3) return;

    // 1. Trier les objets par position actuelle (pour ne pas les croiser)
    const items = equipments.filter(eq => multiSelectedIds.includes(eq.id));
    
    if (axis === 'horizontal') {
        items.sort((a, b) => a.x - b.x);
        const minX = items[0].x;
        const maxX = items[items.length - 1].x;
        const totalGap = maxX - minX;
        const interval = totalGap / (items.length - 1);

        items.forEach((eq, index) => {
            eq.x = minX + (interval * index);
        });

    } else { // Vertical
        items.sort((a, b) => a.y - b.y);
        const minY = items[0].y;
        const maxY = items[items.length - 1].y;
        const totalGap = maxY - minY;
        const interval = totalGap / (items.length - 1);

        items.forEach((eq, index) => {
            eq.y = minY + (interval * index);
        });
    }

    finalizeAlignment();
}

function finalizeAlignment() {
    saveState();      // Sauvegarde dans l'historique
    render();         // Redessine les équipements
    markAsUnsaved();  // Marque comme modifié
    showToast("✅ Objets alignés");
}

/* ==========================================================================
   GESTION DES NOTES / ÉTIQUETTES LIBRES
   ========================================================================== */

// 1. Créer une note depuis le clic droit
function addLabelFromContext() {
    document.getElementById("workspaceContextMenu").style.display = "none";
    
    const text = prompt("Texte de la note :", "Nouvelle note");
    if (text) {
        labels.push({
            id: "lbl-" + Date.now(),
            x: suggestedX, // Position du clic droit
            y: suggestedY,
            text: text
        });
        saveState();
        renderLabels();
        showToast("📝 Note ajoutée");
    }
}

// 2. Afficher les notes
/* ==========================================================================
   MISE À JOUR : AFFICHAGE DES NOTES AVEC CONTRÔLES
   (Remplacer l'ancienne fonction renderLabels par celle-ci)
   ========================================================================== */
function renderLabels() {
    // Nettoyage
    document.querySelectorAll(".workspace-label").forEach(el => el.remove());
    const container = document.getElementById("workspace-container");

    labels.forEach(lbl => {
        const div = document.createElement("div");
        div.className = "workspace-label";
        div.id = lbl.id;
        
        // Appliquer le style "Sélectionné" (Rouge) si c'est la bonne note
        if (lbl.id === selectedLabelId) {
            div.classList.add("selected");
        }

        div.style.left = lbl.x + "px";
        div.style.top = lbl.y + "px";

        // Contenu texte
        const textDiv = document.createElement("div");
        textDiv.innerHTML = lbl.text.replace(/\n/g, "<br>");
        div.appendChild(textDiv);

        // --- AJOUT DES BOUTONS DE CONTRÔLE (Si sélectionnée) ---
        if (lbl.id === selectedLabelId) {
            const controls = document.createElement("div");
            controls.className = "label-controls";

            // Bouton Supprimer (Haut Gauche - Croix)
            const delBtn = document.createElement("div");
            delBtn.className = "label-btn btn-delete-label";
            // Utilise l'icône Bootstrap 'x-lg' ou une croix simple '×'
            delBtn.innerHTML = '<i class="bi bi-x-lg"></i>'; 
            delBtn.title = "Supprimer la note";
            delBtn.onmousedown = (e) => { e.stopPropagation(); }; // Bloque le drag
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if(confirm("Supprimer cette note ?")) {
                    labels = labels.filter(l => l.id !== lbl.id);
                    selectedLabelId = null;
                    saveState();
                    renderLabels();
                }
            };

            // Bouton Modifier (Haut Droite - Stylo)
            const editBtn = document.createElement("div");
            editBtn.className = "label-btn btn-edit-label";
            // Utilise l'icône Bootstrap 'pencil-fill' ou un stylo simple '✎'
            editBtn.innerHTML = '<i class="bi bi-pencil-fill"></i>';
            editBtn.title = "Modifier le texte";
            editBtn.onmousedown = (e) => { e.stopPropagation(); };
            editBtn.onclick = (e) => {
                e.stopPropagation();
                editLabelContent(lbl);
            };

            controls.appendChild(delBtn);
            controls.appendChild(editBtn);
            div.appendChild(controls);
        }
        // ----------------------------------------------------

        // Événement : Clic gauche pour SÉLECTIONNER et DÉPLACER
        div.addEventListener("mousedown", (e) => {
            if (e.button === 0) { // Clic gauche uniquement
                e.stopPropagation();
                // Si on clique sur une autre note, on change la sélection
                if (selectedLabelId !== lbl.id) {
                    selectedLabelId = lbl.id;
                    renderLabels(); // On redessine pour afficher les contrôles
                }
                startLabelDrag(e, lbl);
            }
        });

        // Double clic (raccourci pour éditer)
        div.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            editLabelContent(lbl);
        });

        container.appendChild(div);
    });
}

// Petite fonction utilitaire pour l'édition
function editLabelContent(lbl) {
    const newText = prompt("Modifier la note :", lbl.text);
    if (newText !== null) {
        if (newText.trim() === "") {
            // Si vide, on propose de supprimer
            if(confirm("Texte vide. Supprimer la note ?")) {
                labels = labels.filter(l => l.id !== lbl.id);
                selectedLabelId = null;
            }
        } else {
            lbl.text = newText;
        }
        saveState();
        renderLabels();
    }
}

// 3. Logique de déplacement des notes
function startLabelDrag(e, labelObj) {
    e.stopPropagation(); // Ne pas bouger le fond
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = labelObj.x;
    const initialY = labelObj.y;

    const onMove = (ev) => {
        const dx = (ev.clientX - startX) / currentZoom;
        const dy = (ev.clientY - startY) / currentZoom;
        
        labelObj.x = initialX + dx;
        labelObj.y = initialY + dy;
        
        const el = document.getElementById(labelObj.id);
        if(el) {
            el.style.left = labelObj.x + "px";
            el.style.top = labelObj.y + "px";
        }
    };

    const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        saveState();
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
}