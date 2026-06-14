// ===== DIVINE COIFFURE — Appli tablette =====

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxRYxx-XrFL1FsWGskDDF6rP44he2qyXXvSfOQQ_SjrLhXvJ6DN9m5PaVLWSyxDM4cY/exec';

const CHARGES_FIXES   = 200000;   // charges réelles (186k fixes + ~14k matériaux/produits)
const OBJECTIF_CIBLE  = 280000;   // phase 1 : +80k de bénéfice net
const MARKER_POURCENT = Math.round((CHARGES_FIXES / OBJECTIF_CIBLE) * 100); // ~71%

const PIN_PAR_DEFAUT  = '1234';   // changer via le bouton ⚙️ dans l'appli

const SERVICES_NOMS = {
  coiffure:       'Coiffure',
  meches:         'Mèches',
  onglerie:       'Onglerie',
  lave_cheveux:   'Lave cheveux',
  pose_perruque:  'Pose perruque',
  broching:       'Broching',
  produits_soins: 'Produits soins'
};

const PRIX_PAR_SERVICE = {
  coiffure:       [2500, 3000, 3500, 5000, 7000],
  meches:         [2200, 3000, 3500, 4500, 5500],
  onglerie:       [2500, 3000, 3500, 5000],
  lave_cheveux:   [1000, 1500, 2000, 3000],
  pose_perruque:  [3000, 5000, 7000, 10000, 15000],
  broching:       [2000, 3000, 3500, 5000],
  produits_soins: [1000, 1500, 2000, 3500, 5000]
};

// ===== UTILS =====

function dateAujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

function dateHier() {
  const h = new Date();
  h.setDate(h.getDate() - 1);
  return h.toISOString().slice(0, 10);
}

function heureActuelle() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function moisActuel() {
  return new Date().toISOString().slice(0, 7);
}

function moisPrecedent() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}

function formaterMontant(n) {
  return Number(n).toLocaleString('fr-FR') + ' FCFA';
}

function formaterDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function genererID() {
  return dateAujourdhui() + '-' + Date.now();
}

function echapper(texte) {
  return String(texte || '').replace(/[<>"'&]/g, c =>
    ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' }[c])
  );
}

// ===== DATE SAISIE (aujourd'hui / hier) =====

let dateSelectionnee = dateAujourdhui();
let modeHier = false;

function toggleHier() {
  modeHier = !modeHier;
  dateSelectionnee = modeHier ? dateHier() : dateAujourdhui();
  const label  = document.getElementById('date-label');
  const btn    = document.getElementById('btn-hier');
  if (modeHier) {
    label.textContent = '📅 Hier — ' + formaterDate(dateHier());
    label.className   = 'date-label-hier';
    btn.textContent   = '↩️ Revenir à aujourd\'hui';
  } else {
    label.textContent = '📅 Aujourd\'hui';
    label.className   = 'date-label-today';
    btn.textContent   = 'Saisie pour hier ?';
  }
}

// ===== PRIX RAPIDES =====

function afficherPrixRapides() {
  const service = document.getElementById('service').value;
  const zone    = document.getElementById('prix-rapides');
  const chips   = document.getElementById('prix-chips');

  if (!service || !PRIX_PAR_SERVICE[service]) {
    zone.style.display = 'none';
    return;
  }

  chips.innerHTML = '';
  PRIX_PAR_SERVICE[service].forEach(prix => {
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'prix-chip';
    btn.textContent = prix.toLocaleString('fr-FR');
    btn.addEventListener('click', () => {
      document.getElementById('montant').value = prix;
      document.querySelectorAll('.prix-chip').forEach(b => b.classList.remove('selectionne'));
      btn.classList.add('selectionne');
    });
    chips.appendChild(btn);
  });

  zone.style.display = 'block';
}

// ===== AUTOCOMPLETE (uniquement sur le prénom) =====

function rechercherClientesExistantes(terme) {
  if (!terme || terme.length < 2) return [];
  const clientes  = chargerClientes();
  const lower     = terme.toLowerCase();

  // Une entrée par numéro → garder la visite la plus récente
  const vues = {};
  clientes.slice().reverse().forEach(c => {
    const cle = c.telephone || ('__' + c.prenom);
    if (!vues[cle]) vues[cle] = c;
  });

  return Object.values(vues)
    .filter(c => c.prenom.toLowerCase().includes(lower))
    .slice(0, 4);
}

function afficherSuggestions(suggestions) {
  const box = document.getElementById('suggestions-box');
  box.innerHTML = '';

  if (suggestions.length === 0) { box.style.display = 'none'; return; }

  suggestions.forEach(c => {
    const item     = document.createElement('div');
    item.className = 'suggestion-item';

    const nom    = document.createElement('span');
    nom.className   = 'sug-nom';
    nom.textContent = c.prenom;

    const detail    = document.createElement('span');
    detail.className   = 'sug-detail';
    detail.textContent = (c.telephone || 'pas de numéro') + ' · ' +
      (SERVICES_NOMS[c.service] || c.service) + ' · ' +
      'dernière visite : ' + formaterDate(c.date);

    item.appendChild(nom);
    item.appendChild(detail);
    item.addEventListener('click', () => selectionnerCliente(c.prenom, c.telephone));
    box.appendChild(item);
  });

  box.style.display = 'block';
}

function selectionnerCliente(prenom, telephone) {
  document.getElementById('prenom').value    = prenom;
  document.getElementById('telephone').value = telephone || '';
  document.getElementById('suggestions-box').style.display = 'none';
  document.getElementById('service').focus();
}

// ===== ENREGISTREMENT =====

function enregistrerCliente() {
  const prenom    = document.getElementById('prenom').value.trim();
  const telephone = document.getElementById('telephone').value.trim();
  const service   = document.getElementById('service').value;
  const montant   = parseFloat(document.getElementById('montant').value);
  const note      = document.getElementById('note').value.trim();

  if (!service)              { afficherMessage('Choisissez une prestation.', false); return; }
  if (!montant || montant <= 0) { afficherMessage('Entrez un montant valide.', false); return; }

  const entree = {
    id: genererID(),
    date: dateSelectionnee,
    heure: heureActuelle(),
    prenom: prenom || 'Anonyme',
    telephone: telephone,
    service: service,
    montant: montant,
    note: note,
    statut_sync: 'en_attente'
  };

  const clientes = chargerClientes();
  clientes.push(entree);
  sauvegarderClientes(clientes);

  // Reset formulaire
  document.getElementById('prenom').value    = '';
  document.getElementById('telephone').value = '';
  document.getElementById('service').value   = '';
  document.getElementById('montant').value   = '';
  document.getElementById('note').value      = '';
  document.getElementById('suggestions-box').style.display = 'none';
  document.getElementById('prix-rapides').style.display = 'none';
  document.querySelectorAll('.prix-chip').forEach(b => b.classList.remove('selectionne'));

  const label = modeHier ? ' (hier)' : '';
  afficherMessage(`✅ ${entree.prenom} — ${SERVICES_NOMS[service]} — ${formaterMontant(montant)} enregistré${label} !`, true);

  synchroniserEnSilence();
}

function afficherMessage(texte, ok) {
  const el = document.getElementById('message-confirmation');
  el.textContent      = texte;
  el.style.display    = 'block';
  el.style.color      = ok ? '#0A7A3A' : '#C0001A';
  el.style.borderColor = ok ? '#1DB954' : '#E74C3C';
  el.style.background = ok ? '#E8FFF0' : '#FFF0F0';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ===== STOCKAGE LOCAL =====

function chargerClientes() {
  try { return JSON.parse(localStorage.getItem('dc_clientes') || '[]'); }
  catch { return []; }
}

function sauvegarderClientes(c) {
  localStorage.setItem('dc_clientes', JSON.stringify(c));
}

function chargerDernierSync() {
  return localStorage.getItem('dc_derniere_sync') || null;
}

function sauvegarderDernierSync() {
  localStorage.setItem('dc_derniere_sync', new Date().toLocaleString('fr-FR'));
}

// ===== HISTORIQUE DU JOUR =====

function afficherHistorique() {
  const clientes = chargerClientes();
  const aujourd  = dateAujourdhui();
  const duJour   = clientes.filter(c => c.date === aujourd);

  document.getElementById('nb-clients-jour').textContent = duJour.length;
  document.getElementById('ca-jour').textContent = formaterMontant(duJour.reduce((s, c) => s + c.montant, 0));

  const now = new Date();
  const jours = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  const mois  = ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc'];
  document.getElementById('titre-historique').textContent =
    `${jours[now.getDay()]} ${now.getDate()} ${mois[now.getMonth()]} ${now.getFullYear()}`;

  const liste = document.getElementById('liste-historique');
  if (duJour.length === 0) {
    liste.innerHTML = '<p class="vide">Aucune saisie pour aujourd\'hui.</p>';
    return;
  }
  liste.innerHTML = '';
  duJour.slice().reverse().forEach(c => {
    const item = document.createElement('div');
    item.className = 'entree-item';
    item.innerHTML = `
      <div class="entree-info">
        <span class="entree-nom">${echapper(c.prenom)}${c.telephone ? ' · ' + echapper(c.telephone) : ''}</span>
        <span class="entree-detail">${echapper(SERVICES_NOMS[c.service] || c.service)} · ${echapper(c.heure)}</span>
        ${c.note ? `<span class="entree-detail">${echapper(c.note)}</span>` : ''}
        <span class="entree-sync">${c.statut_sync === 'synchronise' ? '✅ Sync' : '📡 En attente'}</span>
      </div>
      <span class="entree-montant">${formaterMontant(c.montant)}</span>`;
    liste.appendChild(item);
  });
}

// ===== STATISTIQUES AVEC SÉLECTEUR DE PÉRIODE =====

let periodeActuelle = 'mois-actuel';
let dateDebutCustom = null;
let dateFinCustom   = null;

function setPeriode(periode, btn) {
  periodeActuelle = periode;
  document.querySelectorAll('.btn-periode').forEach(b => b.classList.remove('actif'));
  if (btn) btn.classList.add('actif');

  const custom = document.getElementById('custom-dates');
  if (periode === 'custom') {
    custom.style.display = 'flex';
    const today = dateAujourdhui();
    if (!document.getElementById('date-fin').value) document.getElementById('date-fin').value = today;
    if (!document.getElementById('date-debut').value) {
      const debut = new Date(); debut.setDate(debut.getDate() - 30);
      document.getElementById('date-debut').value = debut.toISOString().slice(0,10);
    }
  } else {
    custom.style.display = 'none';
  }
  rafraichirStats();
}

function rafraichirStats() {
  const clientes = chargerClientes();
  let filtrées, labelPeriode;

  if (periodeActuelle === 'mois-actuel') {
    const m = moisActuel();
    filtrées = clientes.filter(c => c.date.startsWith(m));
    const now = new Date();
    const moisNoms = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    labelPeriode = moisNoms[now.getMonth()] + ' ' + now.getFullYear();

  } else if (periodeActuelle === 'mois-precedent') {
    const m = moisPrecedent();
    filtrées = clientes.filter(c => c.date.startsWith(m));
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    const moisNoms = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    labelPeriode = moisNoms[d.getMonth()] + ' ' + d.getFullYear();

  } else if (periodeActuelle === '3-mois') {
    const debut = new Date(); debut.setMonth(debut.getMonth() - 3);
    const debutStr = debut.toISOString().slice(0,10);
    filtrées = clientes.filter(c => c.date >= debutStr);
    labelPeriode = '3 derniers mois';

  } else if (periodeActuelle === 'custom') {
    const debut = document.getElementById('date-debut').value;
    const fin   = document.getElementById('date-fin').value;
    if (!debut || !fin) return;
    filtrées = clientes.filter(c => c.date >= debut && c.date <= fin);
    labelPeriode = formaterDate(debut) + ' → ' + formaterDate(fin);

  } else {
    filtrées = [];
    labelPeriode = '';
  }

  afficherStatistiques(filtrées, labelPeriode);
}

function afficherStatistiques(filtrées, labelPeriode) {
  const nb = filtrées.length;
  const ca = filtrées.reduce((s, c) => s + c.montant, 0);

  document.getElementById('nb-clients-mois').textContent = nb;
  document.getElementById('ca-mois').textContent = formaterMontant(ca);
  document.getElementById('periode-affichee').textContent = labelPeriode;

  // Barre vers 242k avec marqueur charges à 77%
  const pourcent = Math.min(100, Math.round((ca / OBJECTIF_CIBLE) * 100));
  document.getElementById('pourcent-objectif').textContent = pourcent + '%';
  document.getElementById('barre-remplie').style.width = pourcent + '%';
  document.getElementById('barre-marker').style.left   = MARKER_POURCENT + '%';

  const statut = document.getElementById('statut-mois');
  if (ca >= OBJECTIF_CIBLE) {
    statut.textContent = '🏆 Objectif atteint ! Salon rentable ce mois — excellent !';
    statut.className   = 'statut ok';
  } else if (ca >= CHARGES_FIXES) {
    const reste = OBJECTIF_CIBLE - ca;
    statut.textContent = `✅ Charges couvertes ! Plus que ${formaterMontant(reste)} pour l'objectif.`;
    statut.className   = 'statut attention';
  } else if (ca >= CHARGES_FIXES * 0.7) {
    const manque = CHARGES_FIXES - ca;
    statut.textContent = `⚠️ En route — encore ${formaterMontant(manque)} pour couvrir les charges.`;
    statut.className   = 'statut attention';
  } else {
    statut.textContent = '📣 Activez les promos et relancez les clientes inactives !';
    statut.className   = 'statut danger';
  }

  // Répartition services
  const parService = {};
  filtrées.forEach(c => { parService[c.service] = (parService[c.service] || 0) + c.montant; });
  const total  = ca || 1;
  const repDiv = document.getElementById('repartition-services');
  const svcs   = Object.entries(parService).sort((a,b) => b[1]-a[1]);

  repDiv.innerHTML = '';
  if (svcs.length === 0) {
    repDiv.innerHTML = '<p class="vide">Aucune donnée sur cette période.</p>';
  } else {
    svcs.forEach(([svc, mt]) => {
      const lg = document.createElement('div');
      lg.className = 'service-ligne';
      lg.innerHTML = `
        <span class="service-nom">${echapper(SERVICES_NOMS[svc] || svc)}</span>
        <div class="service-barre-fond"><div class="service-barre" style="width:${Math.round((mt/total)*100)}%"></div></div>
        <span class="service-montant">${formaterMontant(mt)}</span>`;
      repDiv.appendChild(lg);
    });
  }

  afficherClientesARappeler(chargerClientes());

  const sync = chargerDernierSync();
  document.getElementById('derniere-sync').textContent =
    sync ? 'Dernière sync : ' + sync : 'Jamais synchronisé';
}

// ===== CLIENTES À RAPPELER =====

function afficherClientesARappeler(clientes) {
  const aujourd  = new Date();
  const LIMITE   = 21;
  const vues     = {};

  clientes.forEach(c => {
    if (!c.telephone) return;
    if (!vues[c.telephone] || c.date > vues[c.telephone].date) vues[c.telephone] = c;
  });

  const aRappeler = Object.values(vues)
    .filter(c => Math.floor((aujourd - new Date(c.date)) / 86400000) >= LIMITE)
    .sort((a,b) => a.date.localeCompare(b.date));

  const div = document.getElementById('clientes-a-rappeler');
  if (aRappeler.length === 0) {
    div.innerHTML = '<p class="vide">Toutes vos clientes sont revenues récemment.</p>';
    return;
  }
  div.innerHTML = '';
  aRappeler.forEach(c => {
    const jours = Math.floor((aujourd - new Date(c.date)) / 86400000);
    const item  = document.createElement('div');
    item.className = 'rappel-item';
    item.innerHTML = `
      <div class="rappel-nom">${echapper(c.prenom)}</div>
      <div class="rappel-tel">📞 ${echapper(c.telephone)}</div>
      <div class="rappel-detail">Absente depuis ${jours} jours · dernière visite : ${formaterDate(c.date)} (${echapper(SERVICES_NOMS[c.service] || c.service)})</div>`;
    div.appendChild(item);
  });
}

// ===== SYNC GOOGLE SHEETS =====

async function synchroniser() {
  const clientes  = chargerClientes();
  const enAttente = clientes.filter(c => c.statut_sync === 'en_attente');
  if (enAttente.length === 0) { alert('✅ Tout est déjà synchronisé.'); return; }

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ donnees: enAttente })
    });
    sauvegarderClientes(clientes.map(c =>
      c.statut_sync === 'en_attente' ? { ...c, statut_sync: 'synchronise' } : c
    ));
    sauvegarderDernierSync();
    mettreAJourStatutSync(true);
    afficherHistorique();
    rafraichirStats();
    alert(`✅ ${enAttente.length} entrée(s) envoyée(s) vers Google Sheets.`);
  } catch {
    mettreAJourStatutSync(false);
    alert('❌ Échec. Vérifiez la connexion internet.');
  }
}

async function synchroniserEnSilence() {
  if (!navigator.onLine) return;
  const clientes  = chargerClientes();
  const enAttente = clientes.filter(c => c.statut_sync === 'en_attente');
  if (enAttente.length === 0) return;
  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ donnees: enAttente })
    });
    sauvegarderClientes(clientes.map(c =>
      c.statut_sync === 'en_attente' ? { ...c, statut_sync: 'synchronise' } : c
    ));
    sauvegarderDernierSync();
    mettreAJourStatutSync(true);
  } catch { /* silencieux */ }
}

function mettreAJourStatutSync(ok) {
  const el    = document.getElementById('sync-status');
  el.textContent = ok ? '✅ Synchronisé' : '📡 Hors ligne';
  el.className   = ok ? 'sync-ok' : 'sync-offline';
}

// ===== EXPORT CSV FORMATÉ =====

function exporterCSV() {
  const clientes = chargerClientes();
  if (clientes.length === 0) { alert('Aucune donnée à exporter.'); return; }

  const total = clientes.reduce((s, c) => s + c.montant, 0);

  const lignes = [
    ['Date', 'Heure', 'Prénom', 'Téléphone', 'Prestation', 'Montant (FCFA)', 'Note', 'Statut sync'],
    ...clientes.map(c => [
      formaterDate(c.date),
      c.heure,
      c.prenom,
      c.telephone || '',
      SERVICES_NOMS[c.service] || c.service,
      c.montant,
      c.note || '',
      c.statut_sync === 'synchronise' ? 'Envoyé Google Sheets' : 'En attente'
    ]),
    [],
    ['', '', '', '', 'TOTAL', total, '', '']
  ];

  const csv  = lignes.map(l => l.map(v => `"${(v||'').toString().replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `Divine-Coiffure-${dateAujourdhui()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== CODE PIN =====

let saisiePin = '';

function pinStocke() {
  return localStorage.getItem('dc_pin') || PIN_PAR_DEFAUT;
}

function verifierPin(code) {
  if (code === pinStocke()) {
    document.getElementById('ecran-pin').style.display = 'none';
    document.getElementById('app-contenu').style.display = 'block';
    saisiePin = '';
    mettreAJourPointsPin();
  } else {
    const erreur = document.getElementById('pin-erreur');
    erreur.style.display = 'block';
    setTimeout(() => { erreur.style.display = 'none'; }, 1500);
    saisiePin = '';
    mettreAJourPointsPin();
  }
}

function appuyerTouche(val) {
  if (val === 'effacer') {
    saisiePin = saisiePin.slice(0, -1);
  } else if (saisiePin.length < 4) {
    saisiePin += val;
  }
  mettreAJourPointsPin();
  if (saisiePin.length === 4) {
    setTimeout(() => verifierPin(saisiePin), 150);
  }
}

function mettreAJourPointsPin() {
  document.querySelectorAll('.pin-dot').forEach((dot, i) => {
    dot.classList.toggle('rempli', i < saisiePin.length);
  });
}

function codeOublie() {
  const reponse = prompt('Entrez le code de secours du salon (demandez à Sylvestre) :');
  if (reponse === 'DIVINE2026') {
    localStorage.setItem('dc_pin', PIN_PAR_DEFAUT);
    alert('✅ Code réinitialisé à 1234. Changez-le rapidement dans les paramètres.');
    saisiePin = '';
    mettreAJourPointsPin();
  } else {
    alert('Code de secours incorrect. Contactez Sylvestre.');
  }
}

function changerPin() {
  const ancien  = prompt('Entrez votre code actuel :');
  if (ancien !== pinStocke()) { alert('Code incorrect.'); return; }
  const nouveau = prompt('Nouveau code à 4 chiffres :');
  if (!nouveau || !/^\d{4}$/.test(nouveau)) { alert('Le code doit être 4 chiffres.'); return; }
  const confirm = prompt('Confirmez le nouveau code :');
  if (nouveau !== confirm) { alert('Les codes ne correspondent pas.'); return; }
  localStorage.setItem('dc_pin', nouveau);
  alert('✅ Code modifié avec succès.');
}

// ===== INIT =====

window.addEventListener('DOMContentLoaded', () => {
  // Afficher écran PIN au démarrage
  document.getElementById('ecran-pin').style.display   = 'flex';
  document.getElementById('app-contenu').style.display = 'none';

  document.getElementById('prenom').addEventListener('input', function () {
    afficherSuggestions(rechercherClientesExistantes(this.value));
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#suggestions-box') && !e.target.closest('#prenom')) {
      const box = document.getElementById('suggestions-box');
      if (box) box.style.display = 'none';
    }
  });

  // Positionner le marqueur 186k sur la barre
  const marker = document.getElementById('barre-marker');
  if (marker) marker.style.left = MARKER_POURCENT + '%';
});

window.addEventListener('online',  () => { mettreAJourStatutSync(true);  synchroniserEnSilence(); });
window.addEventListener('offline', () => mettreAJourStatutSync(false));

setInterval(() => { if (navigator.onLine) synchroniserEnSilence(); }, 5 * 60 * 1000);

mettreAJourStatutSync(navigator.onLine);
