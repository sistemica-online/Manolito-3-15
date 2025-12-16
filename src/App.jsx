import React, { useState } from 'react';
import FitParser from 'fit-file-parser'; 
import { saveAs } from 'file-saver';     
import { 
  UploadCloud, Activity, CheckCircle, AlertTriangle, Terminal, FileText
} from 'lucide-react';

// --- ESTILOS (Dark Mode) ---
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

// --- LOGICA M55 ---
const calculateDecoupling = (records) => {
  if (!records || records.length < 10) return 0;

  const midPoint = Math.floor(records.length / 2);
  const firstHalf = records.slice(0, midPoint);
  const secondHalf = records.slice(midPoint);

  const getAvg = (arr, field) => {
    let sum = 0;
    let count = 0;
    arr.forEach(r => {
      if (r[field]) {
        sum += r[field];
        count++;
      }
    });
    return count > 0 ? sum / count : 0;
  };

  const avgSpeed1 = getAvg(firstHalf, 'speed');
  const avgHR1 = getAvg(firstHalf, 'heart_rate');
  const ef1 = avgHR1 > 0 ? avgSpeed1 / avgHR1 : 0;

  const avgSpeed2 = getAvg(secondHalf, 'speed');
  const avgHR2 = getAvg(secondHalf, 'heart_rate');
  const ef2 = avgHR2 > 0 ? avgSpeed2 / avgHR2 : 0;

  if (ef1 === 0) return 0;
  
  // Decoupling positivo = Pérdida de eficiencia (malo)
  // Decoupling negativo = Ganancia (raro, o bajada de ritmo)
  return (((ef1 - ef2) / ef1) * 100).toFixed(2);
};

export default function App() {
  const [status, setStatus] = useState('IDLE'); 
  const [metrics, setMetrics] = useState(null);
  const [csvContent, setCsvContent] = useState(null);
  const [fileName, setFileName] = useState("");
  const [debugInfo, setDebugInfo] = useState("");

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setStatus('PARSING');
    setMetrics(null);
    setCsvContent(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      
      // CONFIGURACIÓN CORREGIDA: Sin 'cascade' para lectura plana
      const fitParser = new FitParser({
        force: true,
        speedUnit: 'km/h',
        lengthUnit: 'km',
        temperatureUnit: 'celsius',
        elapsedRecordField: true,
        // mode: 'cascade',  <-- ELIMINADO: Causa del error
      });

      fitParser.parse(content, (error, data) => {
        if (error) {
          console.error("Error parser:", error);
          setStatus('ERROR');
          setDebugInfo("Error crítico leyendo el archivo binary FIT.");
          return;
        }

        console.log("Datos crudos del FIT:", data); // Para depuración en consola F12

        // Intentamos localizar los 'records' (telemetría segundo a segundo)
        // A veces se llaman 'records', a veces 'record'
        const records = data.records || data.record || [];

        if (records.length === 0) {
          setStatus('ERROR');
          setDebugInfo("El archivo se leyó, pero no contiene registros de actividad (array 'records' vacío). ¿Es un archivo de actividad válido?");
          return;
        }

        // --- CÁLCULOS ---
        const decoupling = calculateDecoupling(records);
        const totalDist = records[records.length - 1]?.distance || 0;
        
        // Media HR (filtrando ceros)
        const validHRs = records.filter(r => r.heart_rate > 0);
        const avgHR = validHRs.length > 0 
          ? Math.round(validHRs.reduce((a, b) => a + b.heart_rate, 0) / validHRs.length) 
          : 0;

        setMetrics({
          recordsCount: records.length,
          distance: typeof totalDist === 'number' ? totalDist.toFixed(2) : "N/A",
          avgHR: avgHR,
          decoupling: decoupling
        });

        // --- GENERAR CSV ---
        // Construimos el CSV línea a línea asegurando que haya datos
        let csv = "Timestamp,Distance_km,Speed_kmh,HeartRate_bpm,Cadence_spm,Altitude_m,Power_w,GCT_Balance,Vert_Osc_mm\n";
        
        records.forEach(r => {
           // Extracción segura de datos (si no existe, pon vacío)
           const ts = r.timestamp ? new Date(r.timestamp).toISOString() : "";
           const dist = r.distance || "";
           const spd = r.speed || "";
           const hr = r.heart_rate || "";
           const cad = r.cadence || "";
           const alt = r.altitude || "";
           const pwr = r.power || "";
           const gct = r.stance_time_balance || ""; // Garmin Balance
           const osc = r.vertical_oscillation || "";

           csv += `${ts},${dist},${spd},${hr},${cad},${alt},${pwr},${gct},${osc}\n`;
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
          M55 <span style={{ color: STYLES.neonBlue }}>DECODER V2</span>
        </h1>
        <p style={{ color: STYLES.textDim, fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px' }}>
          EXTRACCIÓN DE STREAMS DE GARMIN (.FIT)
        </p>
      </div>

      {/* DROPZONE */}
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ 
          border: `2px dashed ${status === 'SUCCESS' ? STYLES.neonGreen : (status === 'ERROR' ? STYLES.neonRed : STYLES.border)}`, 
          borderRadius: '16px', 
          backgroundColor: STYLES.card,
          padding: '60px 20px',
          textAlign: 'center',
          position: 'relative',
          transition: 'all 0.3s'
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
                {status === 'PARSING' && "Analizando estructura FIT..."}
                {status === 'SUCCESS' && "¡Lectura Completada!"}
                {status === 'ERROR' && "Error de lectura"}
              </h3>
              <p style={{ fontSize: '12px', color: STYLES.textDim, marginTop: '8px' }}>
                {status === 'ERROR' ? debugInfo : (fileName || "Soporta Garmin Nativo")}
              </p>
            </div>
          </div>
        </div>

        {/* RESULTADOS */}
        {status === 'SUCCESS' && metrics && (
          <div style={{ marginTop: '32px' }}>
            
            {/* KPI GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
              
              <div style={{ backgroundColor: STYLES.card, border: `1px solid ${STYLES.border}`, padding: '16px', borderRadius: '12px' }}>
                <div style={{ fontSize: '10px', color: STYLES.textDim, fontWeight: 'bold' }}>REGISTROS</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'monospace' }}>{metrics.recordsCount}</div>
              </div>

              <div style={{ backgroundColor: STYLES.card, border: `1px solid ${STYLES.border}`, padding: '16px', borderRadius: '12px' }}>
                <div style={{ fontSize: '10px', color: STYLES.textDim, fontWeight: 'bold' }}>FC MEDIA</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'monospace', color: STYLES.neonRed }}>{metrics.avgHR}</div>
              </div>

              <div style={{ backgroundColor: STYLES.card, border: `1px solid ${STYLES.border}`, padding: '16px', borderRadius: '12px' }}>
                <div style={{ fontSize: '10px', color: STYLES.textDim, fontWeight: 'bold' }}>DESACOPLE</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'monospace', color: metrics.decoupling > 5 ? STYLES.neonRed : STYLES.neonGreen }}>
                  {metrics.decoupling}%
                </div>
              </div>
            
            </div>

            {/* BOTÓN CSV */}
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
                gap: '8px'
              }}
            >
              <FileText size={18} />
              DESCARGAR CSV PROCESADO
            </button>
            <p style={{ textAlign: 'center', fontSize: '10px', color: STYLES.textDim, marginTop: '12px' }}>
               Listo para subir a tu Analista IA (Contiene GCT y Streams)
            </p>

          </div>
        )}
      </div>
    </div>
  );
}