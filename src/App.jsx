import React, { useState } from 'react';
import FitParser from 'fit-file-parser'; 
import { saveAs } from 'file-saver';     
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area
} from 'recharts';
import { 
  UploadCloud, Activity, Heart, Zap, Footprints, FileText, 
  ArrowRight, Mountain, Gauge, Ruler, PlusCircle, Map, Percent, Microscope
} from 'lucide-react';

// --- ESTILOS "M55 DARK" ---
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
  neonPurple: '#d946ef', 
  neonOrange: '#f97316', 
  neonMagenta: '#ec4899',
  grid: '#334155'
};

export default function App() {
  const [status, setStatus] = useState('IDLE'); 
  const [debugData, setDebugData] = useState(null);
  const [fileName, setFileName] = useState("");

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setStatus('PARSING');
    setDebugData(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const fitParser = new FitParser({
        force: true, speedUnit: 'km/h', lengthUnit: 'km', elapsedRecordField: true
      });

      fitParser.parse(e.target.result, (error, resultData) => {
        if (error) { setStatus('ERROR'); return; }

        const records = resultData.records || resultData.record || [];
        
        // --- RAYOS X: BUSCAMOS UN REGISTRO "JUGOSO" ---
        // Buscamos un registro que tenga datos (no el primero que a veces está vacío)
        // Cogemos el registro número 100 o el del medio
        const idx = Math.min(records.length - 1, 100);
        const sample = records[idx];

        if (sample) {
            // Preparamos el informe
            const keys = Object.keys(sample);
            const values = JSON.stringify(sample, null, 2);
            setDebugData({ keys, values });
        }
        
        setStatus('SUCCESS');
      });
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: STYLES.bg, color: STYLES.text, fontFamily: 'sans-serif', padding: '20px' }}>
      
      {/* HEADER */}
      <div style={{ maxWidth: '800px', margin: '0 auto', marginBottom: '40px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px' }}>
          M55 <span style={{ color: STYLES.neonBlue }}>X-RAY</span>
        </h1>
        <p style={{ color: STYLES.textDim, fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px' }}>
          DIAGNÓSTICO ESTRUCTURAL PROFUNDO
        </p>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>

        <div style={{ 
            border: `2px dashed ${STYLES.border}`, borderRadius: '16px', backgroundColor: STYLES.card,
            padding: '40px', textAlign: 'center', marginBottom: '40px', position: 'relative'
          }}>
            <input type="file" accept=".fit" onChange={handleFileUpload} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
            <UploadCloud size={48} color={STYLES.neonBlue} style={{ marginBottom: '16px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>Sube el archivo "Misterioso"</h3>
            <p style={{ color: STYLES.textDim, fontSize: '12px', marginTop: '8px' }}>Vamos a verle las tripas</p>
        </div>

        {/* INFORME DE RAYOS X */}
        {status === 'SUCCESS' && debugData && (
          <div style={{ animation: 'fadeIn 0.5s' }}>
            
            <div style={{ backgroundColor: '#0f172a', border: `1px solid ${STYLES.neonBlue}`, borderRadius: '12px', padding: '20px', fontFamily: 'monospace', fontSize: '12px', color: STYLES.neonBlue, overflowX: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: `1px solid ${STYLES.border}`, paddingBottom: '10px' }}>
                    <Microscope size={20} /> ESTRUCTURA INTERNA DEL REGISTRO #100
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <strong style={{ color: 'white' }}>CAMPOS DISPONIBLES (NOMBRES INTERNOS):</strong><br/>
                    <div style={{ marginTop: '8px', color: '#94a3b8', wordBreak: 'break-all' }}>
                        {debugData.keys.join(', ')}
                    </div>
                </div>

                <div>
                    <strong style={{ color: 'white' }}>VALORES DE EJEMPLO:</strong><br/>
                    <pre style={{ marginTop: '8px', color: '#cbd5e1', backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px' }}>
                        {debugData.values}
                    </pre>
                </div>
            </div>

            <p style={{ textAlign: 'center', marginTop: '20px', color: STYLES.textDim }}>
                Copia el contenido del recuadro azul y pégalo en el chat.
            </p>

          </div>
        )}

      </div>
    </div>
  );
}