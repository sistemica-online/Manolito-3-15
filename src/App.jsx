import React, { useState, useCallback } from 'react';
import FitParser from 'fit-file-parser'; // El decodificador
import { saveAs } from 'file-saver';     // El exportador
import { 
  UploadCloud, FileDown, Activity, Heart, Zap, 
  AlertTriangle, CheckCircle, Terminal 
} from 'lucide-react';

// --- ESTILOS M55 (Dark Mode Hardcoded) ---
const STYLES = {
  bg: '#0b0c15',
  card: '#151621',
  border: '#1e293b',
  text: '#e2e8f0',
  textDim: '#64748b',
  neonBlue: '#00f2ff',
  neonGreen: '#00ff9d',
  neonRed: '#ff0055',
  neonAmber: '#ffb700',
};

// --- UTILIDADES MATEMÁTICAS M55 ---
const calculateDecoupling = (records) => {
  // Algoritmo: Dividimos la sesión en 2 mitades (excluyendo calentamiento/enfriamiento si quisiéramos)
  // Aquí lo hacemos bruto: 1ª mitad vs 2ª mitad.
  if (!records || records.length < 600) return null; // Mínimo 10 min

  const midPoint = Math.floor(records.length / 2);
  const firstHalf = records.slice(0, midPoint);
  const secondHalf = records.slice(midPoint);

  const getAvg = (arr, field) => {
    const sum = arr.reduce((acc, r) => acc + (r[field] || 0), 0);
    return (sum / arr.length) || 1;
  };

  // EF = Speed / HR
  const avgSpeed1 = getAvg(firstHalf, 'speed');
  const avgHR1 = getAvg(firstHalf, 'heart_rate');
  const ef1 = avgHR1 > 0 ? avgSpeed1 / avgHR1 : 0;

  const avgSpeed2 = getAvg(secondHalf, 'speed');
  const avgHR2 = getAvg(secondHalf, 'heart_rate');
  const ef2 = avgHR2 > 0 ? avgSpeed2 / avgHR2 : 0;

  if (ef1 === 0) return 0;
  
  // Decoupling %: Cuánto cayó la eficiencia en la 2ª mitad
  const decoupling = ((ef1 - ef2) / ef1) * 100;
  return decoupling.toFixed(2);
};

export default function App() {
  const [status, setStatus] = useState('IDLE'); // IDLE, PARSING, SUCCESS, ERROR
  const [metrics, setMetrics] = useState(null);
  const [csvContent, setCsvContent] = useState(null);
  const [fileName, setFileName] = useState("");

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setStatus('PARSING');

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const fitParser = new FitParser({
        force: true,
        speedUnit: 'km/h',
        lengthUnit: 'km',
        temperatureUnit: 'celsius',
        elapsedRecordField: true,
        mode: 'cascade',
      });

      fitParser.parse(content, (error, data) => {
        if (error) {
          console.error(error);
          setStatus('ERROR');
          return;
        }

        // --- 1. EXTRACCIÓN DE STREAMS (EL DESTRIPADO) ---
        // Aquí sacamos solo lo que nos interesa del archivo FIT gigante
        const records = data.records || [];
        
        // --- 2. CÁLCULOS EN VIVO (M55 LOGIC) ---
        const decoupling = calculateDecoupling(records);
        const totalDistance = records[records.length - 1]?.distance || 0;
        const avgHR = records.reduce((acc, r) => acc + (r.heart_rate || 0), 0) / records.length;

        setMetrics({
          recordsCount: records.length,
          distance: totalDistance.toFixed(2),
          avgHR: Math.round(avgHR),
          decoupling: decoupling
        });

        // --- 3. GENERACIÓN DEL CSV PARA LA IA ---
        // Preparamos las cabeceras que le gustan a ChatGPT/Claude
        let csv = "Timestamp,Distance_km,Speed_kmh,HeartRate_bpm,Cadence_spm,Altitude_m,Power_w,GCT_Balance_Pct_Left,Vertical_Osc_mm\n";
        
        records.forEach(r => {
            // Normalización de GCT Balance (Garmin lo da a veces como 50.5 o como 128 bit mask)
            // Nota: fit-file-parser a veces da 'stance_time_balance' ya procesado o crudo.
            // Para este prototipo volcamos lo que haya para analizarlo.
            const gct = r.stance_time_balance || ""; 
            const pwr = r.power || "";
            
            csv += `${r.timestamp},${r.distance},${r.speed},${r.heart_rate},${r.cadence},${r.altitude},${pwr},${gct},${r.vertical_oscillation}\n`;
        });

        setCsvContent(csv);
        setStatus('SUCCESS');
      });
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadCSV = () => {
    if (!csvContent) return;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    saveAs(blob, `M55_RAW_${fileName}.csv`);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: STYLES.bg, color: STYLES.text, fontFamily: 'sans-serif', padding: '20px' }}>
      
      {/* HEADER */}
      <div style={{ maxWidth: '800px', margin: '0 auto', marginBottom: '40px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px' }}>
          M55 <span style={{ color: STYLES.neonBlue }}>DECODER</span>
        </h1>
        <p style={{ color: STYLES.textDim, fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px' }}>
          INGESTA DE TELEMETRÍA BRUTA (.FIT)
        </p>
      </div>

      {/* ZONA DE CARGA (DROPZONE SIMULADA) */}
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ 
          border: `2px dashed ${status === 'SUCCESS' ? STYLES.neonGreen : STYLES.border}`, 
          borderRadius: '16px', 
          backgroundColor: STYLES.card,
          padding: '60px 20px',
          textAlign: 'center',
          transition: 'all 0.3s ease',
          position: 'relative'
        }}>
          
          <input 
            type="file" 
            accept=".fit" 
            onChange={handleFileUpload}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            {status === 'IDLE' && <UploadCloud size={48} color={STYLES.neonBlue} />}
            {status === 'PARSING' && <Activity size={48} color={STYLES.neonAmber} className="animate-pulse" />}
            {status === 'SUCCESS' && <CheckCircle size={48} color={STYLES.neonGreen} />}
            {status === 'ERROR' && <AlertTriangle size={48} color={STYLES.neonRed} />}

            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>
                {status === 'IDLE' && "Arrastra tu archivo .FIT aquí"}
                {status === 'PARSING' && "Destripando archivo..."}
                {status === 'SUCCESS' && "¡Datos Extraídos con Éxito!"}
                {status === 'ERROR' && "Error leyendo el archivo"}
              </h3>
              <p style={{ fontSize: '12px', color: STYLES.textDim, marginTop: '8px' }}>
                {status === 'IDLE' ? "Soporta archivos nativos de Garmin/Coros/Suunto" : fileName}
              </p>
            </div>
          </div>
        </div>

        {/* PANEL DE RESULTADOS M55 */}
        {status === 'SUCCESS' && metrics && (
          <div style={{ marginTop: '32px', animation: 'fadeIn 0.5s' }}>
            
            {/* 1. MÉTRICAS INSTANTÁNEAS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              <div style={{ backgroundColor: STYLES.card, border: `1px solid ${STYLES.border}`, padding: '16px', borderRadius: '12px' }}>
                <div style={{ fontSize: '10px', color: STYLES.textDim, fontWeight: 'bold' }}>PUNTOS DE DATO</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'monospace' }}>{metrics.recordsCount}</div>
              </div>
              <div style={{ backgroundColor: STYLES.card, border: `1px solid ${STYLES.border}`, padding: '16px', borderRadius: '12px' }}>
                <div style={{ fontSize: '10px', color: STYLES.textDim, fontWeight: 'bold' }}>FC MEDIA</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'monospace', color: STYLES.neonRed }}>{metrics.avgHR} <span style={{fontSize:'10px'}}>ppm</span></div>
              </div>
              <div style={{ backgroundColor: STYLES.card, border: `1px solid ${STYLES.border}`, padding: '16px', borderRadius: '12px' }}>
                <div style={{ fontSize: '10px', color: STYLES.textDim, fontWeight: 'bold' }}>DESACOPLE (Pa:HR)</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'monospace', color: metrics.decoupling > 5 ? STYLES.neonRed : STYLES.neonGreen }}>
                  {metrics.decoupling}%
                </div>
              </div>
            </div>

            {/* 2. BOTÓN DE DESCARGA PARA IA */}
            <button 
              onClick={downloadCSV}
              style={{ 
                width: '100%', 
                backgroundColor: STYLES.neonBlue, 
                color: '#000', 
                fontWeight: 'bold', 
                padding: '16px', 
                borderRadius: '12px', 
                border: 'none', 
                cursor: 'pointer',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px',
                fontSize: '14px',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}
            >
              <Terminal size={18} />
              Descargar CSV para Analista IA
            </button>
            
            <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '10px', color: STYLES.textDim }}>
              * Este archivo contiene la telemetría segundo a segundo. Súbelo a ChatGPT/Claude para obtener el JSON de análisis.
            </p>

          </div>
        )}
      </div>
    </div>
  );
}