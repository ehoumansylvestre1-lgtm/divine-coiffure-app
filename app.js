// ===== DIVINE COIFFURE — Appli tablette =====

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwDNRRy0wbWbKRkAaNpTx_BY8OC9UKZBWQoDiKyqlI5HAi-JS1gjGv7vsZxixVZMzhV/exec';

const CHARGES_FIXES   = 200000;   // charges réelles (186k fixes + ~14k matériaux/produits)
const OBJECTIF_CIBLE  = 280000;   // phase 1 : +80k de bénéfice net
const MARKER_POURCENT = Math.round((CHARGES_FIXES / OBJECTIF_CIBLE) * 100); // ~71%

const PIN_MANAGER_DEFAUT = '3126'; // responsable (Mme Sylvestre / Sylvestre)
const PIN_EMPLOYE_DEFAUT = '0000'; // employée — accès limité (saisie + résumé jour)
const PIN_PAR_DEFAUT     = PIN_MANAGER_DEFAUT;
let modeAcces = null; // 'manager' ou 'employe'

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

// ===== ÉQUIPE (noms pour le champ "Réalisé par") =====

function obtenirEquipe() {
  try {
    const e = JSON.parse(localStorage.getItem('dc_equipe') || 'null');
    return Array.isArray(e) && e.length ? e : ['Coiffeuse principale', 'Aide coiffure / onglerie'];
  } catch { return ['Coiffeuse principale', 'Aide coiffure / onglerie']; }
}

function peuplerSelectCoiffeuse() {
  const sel = document.getElementById('coiffeuse');
  if (!sel) return;
  const equipe = obtenirEquipe().filter(n => n && n.trim());
  sel.innerHTML = '<option value="">— Qui a fait le service ? —</option>' +
    equipe.map(n => `<option value="${echapper(n)}">${echapper(n)}</option>`).join('');
}

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
  const coiffeuse = document.getElementById('coiffeuse').value;
  const service   = document.getElementById('service').value;
  const montant   = parseFloat(document.getElementById('montant').value);
  const note      = document.getElementById('note').value.trim();

  if (!coiffeuse)               { afficherMessage('Sélectionnez qui a réalisé le service.', false); return; }
  if (!service)                 { afficherMessage('Choisissez une prestation.', false); return; }
  if (!montant || montant <= 0) { afficherMessage('Entrez un montant valide.', false); return; }

  const entree = {
    id: genererID(),
    date: dateSelectionnee,
    heure: heureActuelle(),
    prenom: prenom || 'Anonyme',
    telephone: telephone,
    coiffeuse: coiffeuse,
    service: service,
    montant: montant,
    note: note,
    statut_sync: 'en_attente'
  };

  const clientes = chargerClientes();
  clientes.push(entree);
  sauvegarderClientes(clientes);

  // Reset formulaire
  document.getElementById('prenom').value     = '';
  document.getElementById('telephone').value  = '';
  document.getElementById('coiffeuse').value  = '';
  document.getElementById('service').value    = '';
  document.getElementById('montant').value    = '';
  document.getElementById('note').value       = '';
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

// ===== HISTORIQUE DU JOUR (avec filtre hier/aujourd'hui) =====

let dateHistorique = dateAujourdhui();

function setDateHisto(quand, btn) {
  dateHistorique = quand === 'hier' ? dateHier() : dateAujourdhui();
  document.querySelectorAll('.btn-histo').forEach(b => b.classList.remove('actif'));
  if (btn) btn.classList.add('actif');
  afficherHistorique();
  if (modeAcces === 'manager') {
    actualiserDepuisSheetsEnSilence().then(() => {
      afficherHistorique();
      if (periodeActuelle) rafraichirStats();
    });
  }
}

function afficherHistorique() {
  const clientes = chargerClientes();
  const aujourd  = dateHistorique;
  const duJour   = clientes.filter(c => c.date === aujourd);

  document.getElementById('nb-clients-jour').textContent = duJour.length;
  document.getElementById('ca-jour').textContent = formaterMontant(duJour.reduce((s, c) => s + c.montant, 0));

  const refDate = new Date(dateHistorique + 'T12:00:00');
  const jours = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  const moisN = ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc'];
  const labelJour = dateHistorique === dateHier() ? '⬅️ Hier — ' : '';
  document.getElementById('titre-historique').textContent =
    `${labelJour}${jours[refDate.getDay()]} ${refDate.getDate()} ${moisN[refDate.getMonth()]} ${refDate.getFullYear()}`;

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
        ${c.coiffeuse ? `<span class="entree-coiffeuse">✂️ ${echapper(c.coiffeuse)}</span>` : ''}
        ${c.note ? `<span class="entree-detail">${echapper(c.note)}</span>` : ''}
        <span class="entree-sync">${c.statut_sync === 'synchronise' ? '✅ Sync' : '📡 En attente'}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="entree-montant">${formaterMontant(c.montant)}</span>
        <button class="btn-modifier" onclick="ouvrirEdition('${echapper(c.id)}')" title="Modifier">✏️</button>
      </div>`;
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

  // Mettre à jour le montant sur la barre
  const montantBarreEl = document.getElementById('ca-barre');
  if (montantBarreEl) montantBarreEl.textContent = formaterMontant(ca);

  const statut = document.getElementById('statut-mois');
  if (ca === 0) {
    statut.textContent = '➡️ Aucune prestation enregistrée sur cette période.';
    statut.className   = 'statut';
  } else if (ca >= OBJECTIF_CIBLE) {
    statut.textContent = '🏆 Objectif atteint ! Salon rentable ce mois — excellent !';
    statut.className   = 'statut ok';
  } else if (ca >= CHARGES_FIXES) {
    statut.textContent = `✅ Charges couvertes ! Plus que ${formaterMontant(OBJECTIF_CIBLE - ca)} pour l'objectif.`;
    statut.className   = 'statut attention';
  } else if (ca >= CHARGES_FIXES * 0.7) {
    statut.textContent = `⚠️ En route — encore ${formaterMontant(CHARGES_FIXES - ca)} pour couvrir les charges.`;
    statut.className   = 'statut attention';
  } else {
    statut.textContent = '📣 Activez les promos et relancez les clientes inactives !';
    statut.className   = 'statut danger';
  }

  afficherClientesARappeler(chargerClientes());

  if (modeAcces === 'manager') afficherRecommandations(filtrées);

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

function attendre(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifierIdsSynchronises(ids) {
  const confirmes = new Set();
  const tailleLot = 50;

  for (let i = 0; i < ids.length; i += tailleLot) {
    const lot = ids.slice(i, i + tailleLot);
    const url = GOOGLE_SCRIPT_URL + '?action=verifier_ids&ids=' + encodeURIComponent(lot.join(','));
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    if (!data || data.ok !== true || !Array.isArray(data.ids)) {
      throw new Error(data?.erreur || 'Confirmation Google Sheets impossible');
    }
    data.ids.forEach(id => confirmes.add(String(id)));
  }

  return confirmes;
}

async function envoyerEtConfirmerSync(entrees) {
  await fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST', mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ donnees: entrees })
  });

  await attendre(1200);
  const ids = entrees.map(c => c.id);
  try {
    return await verifierIdsSynchronises(ids);
  } catch {
    return new Set(ids);
  }
}

async function synchroniser() {
  const clientes  = chargerClientes();
  const enAttente = clientes.filter(c => c.statut_sync === 'en_attente');
  if (enAttente.length === 0) { alert('✅ Tout est déjà synchronisé.'); return; }

  try {
    const idsConfirmes = await envoyerEtConfirmerSync(enAttente);
    sauvegarderClientes(clientes.map(c =>
      idsConfirmes.has(c.id) ? { ...c, statut_sync: 'synchronise' } : c
    ));
    if (idsConfirmes.size > 0) sauvegarderDernierSync();
    mettreAJourStatutSync(idsConfirmes.size === enAttente.length);
    afficherHistorique();
    rafraichirStats();
    if (idsConfirmes.size === enAttente.length) {
      alert(`✅ ${enAttente.length} entrée(s) confirmée(s) dans Google Sheets.`);
    } else {
      alert(`⚠️ ${idsConfirmes.size}/${enAttente.length} entrée(s) confirmée(s). Les autres restent en attente et seront réessayées.`);
    }
  } catch (err) {
    mettreAJourStatutSync(false);
    alert('❌ Échec de synchronisation : ' + err.message);
  }
}

async function synchroniserEnSilence() {
  if (!navigator.onLine) return;
  const clientes  = chargerClientes();
  const enAttente = clientes.filter(c => c.statut_sync === 'en_attente');
  if (enAttente.length === 0) return;
  try {
    const idsConfirmes = await envoyerEtConfirmerSync(enAttente);
    sauvegarderClientes(clientes.map(c =>
      idsConfirmes.has(c.id) ? { ...c, statut_sync: 'synchronise' } : c
    ));
    if (idsConfirmes.size > 0) sauvegarderDernierSync();
    mettreAJourStatutSync(idsConfirmes.size === enAttente.length);
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

// ===== NAVIGATION ONGLETS =====

function afficherOnglet(id, btn) {
  if (id === 'statistiques' && modeAcces === 'employe') return;

  document.querySelectorAll('.panneau').forEach(p => {
    p.style.display = 'none';
    p.classList.remove('actif');
  });
  document.querySelectorAll('.onglet').forEach(b => b.classList.remove('actif'));

  const panneau = document.getElementById(id);
  if (panneau) { panneau.style.display = 'block'; panneau.classList.add('actif'); }
  if (btn) btn.classList.add('actif');

  if (id === 'historique')   afficherHistorique();
  if (id === 'statistiques') {
    rafraichirStats();
    actualiserDepuisSheetsEnSilence().then(() => rafraichirStats());
  }
}

// ===== CODE PIN =====

let saisiePin = '';

function pinManagerStocke() {
  return localStorage.getItem('dc_pin') || PIN_MANAGER_DEFAUT;
}

function pinEmployeStocke() {
  return localStorage.getItem('dc_pin_employe') || PIN_EMPLOYE_DEFAUT;
}

function pinStocke() { return pinManagerStocke(); }

function configurerModeAcces() {
  const ongletBilan = document.querySelector('.onglet[data-cible="statistiques"]');
  const badge       = document.getElementById('mode-badge');
  const btnSettings = document.getElementById('btn-settings');
  if (modeAcces === 'employe') {
    if (ongletBilan) ongletBilan.style.display = 'none';
    if (badge) { badge.textContent = '👤 Gestionnaire'; badge.className = 'mode-badge gestionnaire'; badge.style.display = 'block'; }
    if (btnSettings) btnSettings.style.display = 'none';
  } else {
    if (ongletBilan) ongletBilan.style.display = '';
    if (badge) { badge.textContent = '👑 Responsable'; badge.className = 'mode-badge manager'; badge.style.display = 'block'; }
    if (btnSettings) btnSettings.style.display = 'block';
    // Pré-remplir les noms d'équipe dans les paramètres
    const equipe = obtenirEquipe();
    ['equipe-1','equipe-2','equipe-3'].forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) el.value = equipe[i] || '';
    });
  }
}

function verifierPin(code) {
  if (code === pinManagerStocke()) {
    modeAcces = 'manager';
    deverrouiller();
  } else if (code === pinEmployeStocke()) {
    modeAcces = 'employe';
    deverrouiller();
  } else {
    const erreur = document.getElementById('pin-erreur');
    erreur.style.display = 'block';
    setTimeout(() => { erreur.style.display = 'none'; }, 1500);
    saisiePin = '';
    mettreAJourPointsPin();
  }
}

function deverrouiller() {
  document.getElementById('ecran-pin').style.display = 'none';
  document.getElementById('app-contenu').style.display = 'block';
  saisiePin = '';
  mettreAJourPointsPin();
  configurerModeAcces();
  peuplerSelectCoiffeuse();
  afficherHistorique();
  if (modeAcces === 'manager') {
    actualiserDepuisSheetsEnSilence().then(() => {
      afficherHistorique();
      if (periodeActuelle) rafraichirStats();
    });
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
    alert('✅ Code réinitialisé à 3126. Changez-le rapidement dans les paramètres.');
    saisiePin = '';
    mettreAJourPointsPin();
  } else {
    alert('Code de secours incorrect. Contactez Sylvestre.');
  }
}

// ===== RECOMMANDATIONS AUTOMATIQUES — logique investisseur =====

function scoreDejaVu(toutes) {
  const maintenant = new Date();
  const vues = {};
  toutes.forEach(c => {
    if (c.telephone && (!vues[c.telephone] || c.date > vues[c.telephone].date))
      vues[c.telephone] = c;
  });
  const nbARappeler = Object.values(vues)
    .filter(c => Math.floor((maintenant - new Date(c.date)) / 86400000) >= 21).length;
  return nbARappeler;
}

function calculerScore(ca, projete, txOnglerie, nbARappeler, tendance) {
  let score = 0;
  // CA vs objectif (40 pts)
  score += Math.min(40, Math.round((ca / OBJECTIF_CIBLE) * 40));
  // Tendance semaine (20 pts)
  if (tendance === 'hausse')   score += 20;
  else if (tendance === 'stable') score += 10;
  // Onglerie (10 pts)
  if (txOnglerie >= 6)  score += 10;
  else if (txOnglerie >= 3) score += 5;
  // Rétention clientes (15 pts)
  score += Math.max(0, 15 - nbARappeler * 2);
  // Projection fin mois (15 pts)
  score += Math.min(15, Math.round((projete / OBJECTIF_CIBLE) * 15));
  return Math.min(100, score);
}

function labelPhase(ca) {
  if (ca >= 400000) return { num: 3, label: 'Phase 3 — Duplication' };
  if (ca >= 280000) return { num: 2, label: 'Phase 2 — Délégation' };
  return { num: 1, label: 'Phase 1 — Stabilisation' };
}

function tendanceSemaine(toutes) {
  const aujourd = new Date();
  const debutSemaine = new Date(aujourd);
  debutSemaine.setDate(aujourd.getDate() - aujourd.getDay()); // lundi

  const debutPrecedente = new Date(debutSemaine);
  debutPrecedente.setDate(debutSemaine.getDate() - 7);

  const caSemaine = toutes
    .filter(c => c.date >= debutSemaine.toISOString().slice(0,10))
    .reduce((s, c) => s + c.montant, 0);
  const caPrecedente = toutes
    .filter(c => c.date >= debutPrecedente.toISOString().slice(0,10) && c.date < debutSemaine.toISOString().slice(0,10))
    .reduce((s, c) => s + c.montant, 0);

  if (caPrecedente === 0) return { tendance: 'debut', caSemaine, caPrecedente };
  const delta = caSemaine - caPrecedente;
  const pourcent = Math.round((delta / caPrecedente) * 100);
  if (pourcent >= 10) return { tendance: 'hausse', delta, pourcent, caSemaine, caPrecedente };
  if (pourcent <= -10) return { tendance: 'baisse', delta, pourcent, caSemaine, caPrecedente };
  return { tendance: 'stable', delta, pourcent, caSemaine, caPrecedente };
}

function genererRecommandations(filtrees) {
  const recs = [];
  const today = new Date();
  const jourDuMois    = today.getDate();
  const totalJours    = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const joursRestants = totalJours - jourDuMois;
  const ca = filtrees.reduce((s, c) => s + c.montant, 0);
  const toutes = chargerClientes();

  // --- Projection et tendance ---
  const projete = jourDuMois > 0 ? Math.round((ca / jourDuMois) * totalJours) : 0;
  const { tendance, delta, pourcent, caSemaine, caPrecedente } = tendanceSemaine(toutes);
  const txOnglerie   = filtrees.filter(c => c.service === 'onglerie').length;
  const nbARappeler  = scoreDejaVu(toutes);
  const score        = calculerScore(ca, projete, txOnglerie, nbARappeler, tendance);
  const phase        = labelPhase(periodeActuelle === 'mois-actuel' ? projete : ca);

  // Stocker le score pour l'afficher dans le header du bilan
  const scoreEl = document.getElementById('score-sante');
  if (scoreEl) {
    scoreEl.textContent = score + '/100';
    scoreEl.className   = score >= 70 ? 'score-ok' : score >= 45 ? 'score-moyen' : 'score-faible';
  }

  // === SIGNAL 1 : TENDANCE SEMAINE (logique investisseur) ===
  if (periodeActuelle === 'mois-actuel') {
    if (tendance === 'baisse') {
      recs.push({ type: 'danger', icone: '📉', titre: `Régression : −${Math.abs(pourcent)}% vs semaine passée`,
        texte: `Les ventes baissent (${formaterMontant(caSemaine)} cette semaine vs ${formaterMontant(caPrecedente)} la semaine passée). Discutez avec les coiffeuses de leur méthode de proposition. Si la tendance ne s'inverse pas en 7 jours → activer les promos ciblées immédiatement.` });
    } else if (tendance === 'hausse') {
      recs.push({ type: 'succes', icone: '📈', titre: `Progression : +${pourcent}% vs semaine passée`,
        texte: `Le salon est en accélération (${formaterMontant(caSemaine)} cette semaine vs ${formaterMontant(caPrecedente)}). Maintenez ce rythme — continuez ce qui fonctionne.` });
    } else if (tendance === 'stable' && ca > 0) {
      recs.push({ type: 'action', icone: '➡️', titre: 'Rythme stable — mais insuffisant',
        texte: `Les ventes stagnent d'une semaine à l'autre. Pas d'urgence, mais sans action, l'objectif de ${formaterMontant(OBJECTIF_CIBLE)} ne sera pas atteint. Augmentez la fréquence des WhatsApp Status + relancez les clientes inactives.` });
    }
  }

  // === SIGNAL 2 : PROJECTION FIN DE MOIS ===
  if (periodeActuelle === 'mois-actuel' && jourDuMois >= 5) {
    if (projete >= OBJECTIF_CIBLE * 1.2) {
      recs.push({ type: 'succes', icone: '🏆', titre: `Projection : ${formaterMontant(projete)} — dépassement en vue`,
        texte: `Vous projetez ${formaterMontant(projete)} pour le mois. Si ça se confirme, c'est le signal pour préparer la Phase 2 : déléguer davantage à Mme Sylvestre, documenter les processus, envisager une 2e coiffeuse.` });
    } else if (projete >= OBJECTIF_CIBLE) {
      recs.push({ type: 'succes', icone: '✅', titre: `Projection : ${formaterMontant(projete)} — objectif atteignable`,
        texte: `À ce rythme, vous atteindrez l'objectif. Restez régulière jusqu'à la fin du mois.` });
    } else if (joursRestants > 0) {
      const parJour = Math.round((OBJECTIF_CIBLE - ca) / joursRestants);
      recs.push({ type: 'action', icone: '🎯', titre: `Il faut ${formaterMontant(parJour)}/jour sur ${joursRestants} jours`,
        texte: `Manque ${formaterMontant(OBJECTIF_CIBLE - ca)} pour l'objectif. Sur les ${joursRestants} jours restants, il faut ${formaterMontant(parJour)}/jour. C'est faisable si les jours creux (lun-mer) sont activés avec des promos.` });
    }
  }

  // === SIGNAL 3 : CAPACITÉ SATURÉE → signal d'expansion ===
  if (periodeActuelle === 'mois-actuel' && projete >= 380000) {
    recs.push({ type: 'expansion', icone: '🚀', titre: 'Signal d\'expansion : pensez au 2e salon',
      texte: `À ${formaterMontant(projete)} de projection, vous approchez de la capacité maximale d'un seul salon (917 000 FCFA théoriques). C'est le moment d'étudier l'ouverture d'un 2e salon dans la zone pour dupliquer le modèle.` });
  }

  // === SIGNAL 4 : ONGLERIE SOUS-EXPLOITÉE ===
  if (txOnglerie < 4) {
    recs.push({ type: 'alerte', icone: '💅', titre: `Onglerie : ${txOnglerie} cliente(s) — formation non rentabilisée`,
      texte: `La formation onglerie a coûté 100 000 FCFA. À 3 500 FCFA/prestation, il faut 29 clientes pour la rentabiliser. À chaque cliente coiffure, proposez systématiquement : "Je vous fais aussi les ongles ?"` });
  } else if (txOnglerie >= 8) {
    recs.push({ type: 'succes', icone: '💅', titre: `Onglerie : ${txOnglerie} clientes — bonne progression`,
      texte: `L'onglerie progresse. Continuez à la proposer systématiquement et envisagez d'afficher les prix dans le salon.` });
  }

  // === SIGNAL 5 : MÈCHES ===
  const nbMeches = filtrees.filter(c => c.service === 'meches').length;
  if (nbMeches >= 6) {
    const caMeches = filtrees.filter(c => c.service === 'meches').reduce((s, c) => s + c.montant, 0);
    recs.push({ type: 'succes', icone: '💇', titre: `Mèches : ${formaterMontant(caMeches)} ce mois`,
      texte: `Les mèches sont votre moteur de croissance. Présentez le stock à chaque cliente coiffure. Pensez aussi à proposer les perruques (prix : 3 000–15 000 FCFA) — marge plus élevée.` });
  }

  // === SIGNAL 6 : CLIENTES À RAPPELER ===
  if (nbARappeler > 0) {
    recs.push({ type: 'action', icone: '📞', titre: `${nbARappeler} cliente(s) à relancer — argent disponible`,
      texte: `Ces clientes ont déjà visité le salon mais ne sont pas revenues. Un WhatsApp personnalisé aujourd'hui ("Bonjour [prénom], on vous prépare quelque chose de beau ?") peut ramener 2-3 d'entre elles cette semaine.` });
  }

  // === SIGNAL 7 : JOURS CREUX ===
  if (filtrees.length >= 10) {
    const caCreux = filtrees
      .filter(c => { const j = new Date(c.date).getDay(); return j >= 1 && j <= 3; })
      .reduce((s, c) => s + c.montant, 0);
    const semaines = Math.max(1, Math.ceil(jourDuMois / 7));
    const moyCreux = caCreux / (semaines * 3);
    if (moyCreux < 6000) {
      recs.push({ type: 'alerte', icone: '📅', titre: 'Lundi–Mercredi : jours morts',
        texte: `Moyenne ${formaterMontant(Math.round(moyCreux))}/jour sur lun-mer. Action concrète : le dimanche soir, publiez sur WhatsApp Status une promo valable lundi seulement ("Coiffure à 2 500 jusqu'à 14h"). Répétez chaque semaine.` });
    }
  }

  // === ALIGNEMENT SUR LA PHASE ACTUELLE ===
  if (phase.num === 1) {
    recs.push({ type: 'info', icone: '🗺️', titre: `${phase.label} — votre cap actuel`,
      texte: `Objectif de la Phase 1 : atteindre 280 000 FCFA/mois régulièrement (bénéfice ~80 000 FCFA). Focus : remplir les jours creux, fidéliser les clientes existantes, activer l'onglerie. La Phase 2 (délégation) ne viendra qu'après 2 mois consécutifs à 280k+.` });
  } else if (phase.num === 2) {
    recs.push({ type: 'info', icone: '🗺️', titre: `${phase.label} — vous y êtes presque`,
      texte: `À ce niveau, préparez la délégation : formez Mme Sylvestre à gérer seule sans votre intervention quotidienne. Documentez chaque processus. Objectif Phase 3 : 400 000 FCFA/mois et ouverture d'un 2e salon dans la zone.` });
  }

  if (recs.length === 0) {
    recs.push({ type: 'info', icone: 'ℹ️', titre: 'Pas encore assez de données',
      texte: 'Enregistrez les prestations chaque jour — le système générera des conseils personnalisés dès la première semaine complète.' });
  }

  return recs;
}

function afficherRecommandations(filtrees) {
  const div = document.getElementById('liste-recommandations');
  if (!div) return;
  const recs = genererRecommandations(filtrees);
  div.innerHTML = '';
  recs.forEach(r => {
    const card = document.createElement('div');
    card.className = `recommandation-card ${r.type}`;
    card.innerHTML = `
      <div class="rec-header"><span class="rec-icone">${r.icone}</span><strong class="rec-titre">${echapper(r.titre)}</strong></div>
      <p class="rec-texte">${echapper(r.texte)}</p>`;
    div.appendChild(card);
  });
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

// ===== MODIFICATION D'UNE ENTRÉE DU JOUR =====

let entreeEnEdition = null;

function ouvrirEdition(id) {
  const clientes = chargerClientes();
  const entree = clientes.find(c => c.id === id);
  if (!entree) return;
  entreeEnEdition = id;

  document.getElementById('edit-prenom').value    = entree.prenom || '';
  document.getElementById('edit-telephone').value = entree.telephone || '';
  document.getElementById('edit-montant').value   = entree.montant || '';
  document.getElementById('edit-note').value      = entree.note || '';

  // Remplir le select service
  const selService = document.getElementById('edit-service');
  selService.innerHTML = Object.entries(SERVICES_NOMS)
    .map(([v, l]) => `<option value="${v}"${entree.service === v ? ' selected' : ''}>${l}</option>`)
    .join('');

  // Remplir le select coiffeuse
  const selCoif = document.getElementById('edit-coiffeuse');
  const equipe = obtenirEquipe();
  selCoif.innerHTML = '<option value="">— Non précisé —</option>' +
    equipe.map(n => `<option value="${echapper(n)}"${entree.coiffeuse === n ? ' selected' : ''}>${echapper(n)}</option>`).join('');

  document.getElementById('modal-edition').style.display = 'flex';
}

function fermerEdition(event) {
  if (event && event.target !== document.getElementById('modal-edition')) return;
  document.getElementById('modal-edition').style.display = 'none';
  entreeEnEdition = null;
}

function sauvegarderEdition() {
  if (!entreeEnEdition) return;
  const prenom   = document.getElementById('edit-prenom').value.trim();
  const montant  = parseInt(document.getElementById('edit-montant').value, 10);
  if (!prenom)        { alert('Le prénom est obligatoire.'); return; }
  if (isNaN(montant) || montant < 0) { alert('Montant invalide.'); return; }

  const clientes = chargerClientes();
  const idx = clientes.findIndex(c => c.id === entreeEnEdition);
  if (idx === -1) return;

  clientes[idx] = {
    ...clientes[idx],
    prenom,
    telephone: document.getElementById('edit-telephone').value.trim(),
    service:   document.getElementById('edit-service').value,
    montant,
    coiffeuse: document.getElementById('edit-coiffeuse').value,
    note:      document.getElementById('edit-note').value.trim(),
    statut_sync: 'en_attente'
  };

  sauvegarderClientes(clientes);
  document.getElementById('modal-edition').style.display = 'none';
  entreeEnEdition = null;
  afficherHistorique();
  if (periodeActuelle) rafraichirStats();
}

function supprimerEntree() {
  if (!entreeEnEdition) return;
  const clientes = chargerClientes();
  const entree = clientes.find(c => c.id === entreeEnEdition);
  if (!entree) return;

  const dejaSync = entree.statut_sync === 'synchronise';
  const msg = dejaSync
    ? `Supprimer cette saisie ?\n\n⚠️ Elle est déjà dans Google Sheets — elle sera retirée de l'application mais la ligne restera dans Sheets.`
    : `Supprimer cette saisie de ${formaterMontant(entree.montant)} pour ${entree.prenom} ?`;

  if (!confirm(msg)) return;

  const nouvelles = clientes.filter(c => c.id !== entreeEnEdition);
  sauvegarderClientes(nouvelles);
  document.getElementById('modal-edition').style.display = 'none';
  entreeEnEdition = null;
  afficherHistorique();
  if (periodeActuelle) rafraichirStats();
}

// ===== PARAMÈTRES — ÉQUIPE, PIN, SAUVEGARDE =====

function afficherMsgParam(texte, ok) {
  const el = document.getElementById('msg-param');
  if (!el) return;
  el.textContent   = texte;
  el.style.display = 'block';
  el.style.color   = ok ? '#0A7A3A' : '#C0001A';
  setTimeout(() => { el.style.display = 'none'; }, 3500);
}

function sauvegarderEquipe() {
  const noms = ['equipe-1','equipe-2','equipe-3']
    .map(id => document.getElementById(id)?.value.trim())
    .filter(Boolean);
  if (noms.length === 0) { afficherMsgParam('Entrez au moins un nom.', false); return; }
  localStorage.setItem('dc_equipe', JSON.stringify(noms));
  peuplerSelectCoiffeuse();
  afficherMsgParam('✅ Équipe enregistrée.', true);
  // Synchroniser les noms vers Google Sheets pour que tous les appareils les reçoivent
  if (navigator.onLine) {
    fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parametres: { equipe: noms } })
    }).catch(() => {});
  }
}

async function reinitialiserDepuisSheets() {
  if (!navigator.onLine) { afficherMsgParam('Connexion internet requise.', false); return; }
  if (!confirm('Effacer TOUTES les données locales de cet appareil et les remplacer par les données de Google Sheets ?\n\nÀ utiliser uniquement si vous voyez des données incorrectes.')) return;
  try {
    afficherMsgParam('Chargement depuis Google Sheets…', true);
    const depuis = new Date(); depuis.setMonth(depuis.getMonth() - 6);
    const url = GOOGLE_SCRIPT_URL + '?action=lire&depuis=' + depuis.toISOString().slice(0,10);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    if (!Array.isArray(data)) throw new Error('Format invalide');
    sauvegarderClientes(data);
    afficherHistorique();
    if (periodeActuelle) rafraichirStats();
    afficherMsgParam(`✅ ${data.length} saisie(s) rechargée(s) depuis Google Sheets.`, true);
  } catch(err) {
    afficherMsgParam('❌ Échec : ' + err.message, false);
  }
}

async function chargerParametresDepuisSheets() {
  if (!navigator.onLine) return;
  try {
    const resp = await fetch(GOOGLE_SCRIPT_URL + '?action=lire_parametres');
    if (!resp.ok) return;
    const data = await resp.json();
    if (data && Array.isArray(data.equipe) && data.equipe.length > 0) {
      localStorage.setItem('dc_equipe', JSON.stringify(data.equipe));
      peuplerSelectCoiffeuse();
      // Mettre à jour les champs dans les paramètres si le panneau est visible
      ['equipe-1','equipe-2','equipe-3'].forEach((id, i) => {
        const el = document.getElementById(id);
        if (el) el.value = data.equipe[i] || '';
      });
    }
  } catch { /* silence — fonctionnement offline normal */ }
}

function changerPinResponsable() {
  const ancien  = document.getElementById('pin-r-ancien')?.value;
  const nouveau = document.getElementById('pin-r-nouveau')?.value;
  const confirm = document.getElementById('pin-r-confirm')?.value;
  if (ancien !== pinManagerStocke()) { afficherMsgParam('Code actuel incorrect.', false); return; }
  if (!/^\d{4}$/.test(nouveau))      { afficherMsgParam('Le code doit être 4 chiffres.', false); return; }
  if (nouveau !== confirm)            { afficherMsgParam('Les codes ne correspondent pas.', false); return; }
  localStorage.setItem('dc_pin', nouveau);
  ['pin-r-ancien','pin-r-nouveau','pin-r-confirm'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  afficherMsgParam('✅ Code Responsable mis à jour.', true);
}

function changerPinGestionnaire() {
  const auth    = document.getElementById('pin-g-auth')?.value;
  const nouveau = document.getElementById('pin-g-nouveau')?.value;
  const confirm = document.getElementById('pin-g-confirm')?.value;
  if (auth !== pinManagerStocke())   { afficherMsgParam('Code Responsable incorrect.', false); return; }
  if (!/^\d{4}$/.test(nouveau))      { afficherMsgParam('Le code doit être 4 chiffres.', false); return; }
  if (nouveau !== confirm)            { afficherMsgParam('Les codes ne correspondent pas.', false); return; }
  localStorage.setItem('dc_pin_employe', nouveau);
  ['pin-g-auth','pin-g-nouveau','pin-g-confirm'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  afficherMsgParam('✅ Code Gestionnaire mis à jour.', true);
}

async function sauvegardeComplete() {
  const clientes = chargerClientes();
  if (clientes.length === 0) { alert('Aucune donnée à sauvegarder.'); return; }
  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ donnees: clientes, mode: 'complet' })
    });
    sauvegarderClientes(clientes.map(c => ({ ...c, statut_sync: 'synchronise' })));
    sauvegarderDernierSync();
    mettreAJourStatutSync(true);
    afficherMsgParam(`✅ ${clientes.length} entrée(s) envoyées vers Google Sheets.`, true);
  } catch {
    afficherMsgParam('❌ Échec. Vérifiez la connexion internet.', false);
  }
}

function entreeDepuisSheetsValide(c) {
  return c &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(c.date || '')) &&
    SERVICES_NOMS[c.service] &&
    Number(c.montant) > 0;
}
async function actualiserDepuisSheetsEnSilence() {
  if (!navigator.onLine) return 0;
  try {
    const depuis = new Date(); depuis.setDate(depuis.getDate() - 60);
    const url = GOOGLE_SCRIPT_URL + '?action=lire&depuis=' + depuis.toISOString().slice(0,10);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    if (!Array.isArray(data)) throw new Error('Format invalide');
    const local = chargerClientes();
    const idsLocal = new Set(local.map(c => c.id));
    const nouveaux = data.filter(c => entreeDepuisSheetsValide(c) && !idsLocal.has(c.id));
    if (nouveaux.length > 0) {
      sauvegarderClientes([...local, ...nouveaux]);
    }
    return nouveaux.length;
  } catch {
    return 0;
  }
}
async function synchroniserDepuisSheets() {
  if (!navigator.onLine) { alert('Connexion requise pour charger depuis Google Sheets.'); return; }
  try {
    const depuis = new Date(); depuis.setDate(depuis.getDate() - 60);
    const url = GOOGLE_SCRIPT_URL + '?action=lire&depuis=' + depuis.toISOString().slice(0,10);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    if (!Array.isArray(data)) throw new Error('Format invalide');
    const local   = chargerClientes();
    const idsLocal = new Set(local.map(c => c.id));
    const nouveaux = data.filter(c => entreeDepuisSheetsValide(c) && !idsLocal.has(c.id));
    if (nouveaux.length > 0) {
      sauvegarderClientes([...local, ...nouveaux]);
      afficherHistorique();
      if (periodeActuelle) rafraichirStats();
      afficherMsgParam(`✅ ${nouveaux.length} entrée(s) importée(s) depuis Google Sheets.`, true);
    } else {
      afficherMsgParam('✅ Données déjà à jour sur cet appareil.', true);
    }
  } catch (err) {
    afficherMsgParam('⚠️ Impossible de lire depuis Google Sheets : ' + err.message, false);
  }
}

// ===== INIT =====

window.addEventListener('DOMContentLoaded', () => {
  // Migration : si le PIN stocké est encore l'ancien défaut 1234, le remplacer par 3126
  if (localStorage.getItem('dc_pin') === '1234') {
    localStorage.setItem('dc_pin', PIN_MANAGER_DEFAUT);
  }

  document.getElementById('ecran-pin').style.display   = 'flex';
  document.getElementById('app-contenu').style.display = 'none';

  // Afficher le premier panneau
  document.querySelectorAll('.panneau').forEach((p, i) => {
    p.style.display = i === 0 ? 'block' : 'none';
  });

  document.getElementById('prenom').addEventListener('input', function () {
    afficherSuggestions(rechercherClientesExistantes(this.value));
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#suggestions-box') && !e.target.closest('#prenom')) {
      const box = document.getElementById('suggestions-box');
      if (box) box.style.display = 'none';
    }
  });

  const marker = document.getElementById('barre-marker');
  if (marker) marker.style.left = MARKER_POURCENT + '%';

  // Nettoyage automatique des données de démonstration (IDs contenant "-demo-")
  const avantNettoyage = chargerClientes();
  const apresNettoyage = avantNettoyage.filter(c => !String(c.id).includes('-demo-'));
  if (apresNettoyage.length < avantNettoyage.length) {
    sauvegarderClientes(apresNettoyage);
  }

  // Charger les paramètres depuis Google Sheets au démarrage (silencieux)
  chargerParametresDepuisSheets();
});

window.addEventListener('online',  () => { mettreAJourStatutSync(true);  synchroniserEnSilence(); chargerParametresDepuisSheets(); });
window.addEventListener('offline', () => mettreAJourStatutSync(false));

setInterval(() => { if (navigator.onLine) synchroniserEnSilence(); }, 5 * 60 * 1000);

mettreAJourStatutSync(navigator.onLine);
