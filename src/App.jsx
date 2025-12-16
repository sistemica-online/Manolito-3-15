import React, { useState } from 'react';
import FitParser from 'fit-file-parser'; 
import { saveAs } from 'file-saver';     
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area, Legend
} from 'recharts';
import { 
  UploadCloud, Activity, CheckCircle, AlertTriangle, FileText, 
  Heart, Zap, Footprints, ChevronDown
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
  grid: '#334155'
};

// --- LOGICA DE PROCESAMIENTO M55 ---
const processFitData = (records) => {
  if (!records || records.length === 0) return null;

  // 1. Downsampling inteligente (para no bloquear el navegador con 5000 puntos)
  // Tomamos 1 de cada X puntos para gráficas si es muy largo
  const step = records.length > 2000 ? Math.floor(records.length / 1000) : 1;
  
  const chartData = [];
  let totalHR = 0, countHR = 0;
  
  records.forEach((r, i) => {
    // Acumular medias
    if (r.heart_rate) { totalHR += r.heart_rate; countHR++; }

    // Solo añadimos al gráfico según el step
    if (i % step === 0) {
      chartData.push({
        dist: (r.distance / 1000).toFixed(2), // km
        hr: r.heart_rate,
        cadence: r.cadence,
        gct: r.stance_time_balance, // GCT Left %
        vertOsc: r.vertical_oscillation,
        alt: r.altitude
      });
    }
  });

  // Cálculo del Desacople (Pa:HR) simplificado
  // Comparamos eficiencia (pasos/latido o velocidad/latido) 1a mitad vs 2a mitad
  const mid = Math.floor(records.length / 2);
  const h1 = records.slice(0, mid).reduce((a,b) => a + (b.heart_rate||0), 0) / mid;
  const h2 = records.slice(mid).reduce((a,b) => a + (b.heart_rate||0), 0) / (records.length - mid);
  // Si el pulso sube más de un 5% en la segunda mitad asumiendo ritmo estable...
  // (Nota: Esto es una aprox rápida para el dashboard inmediato)
  const decoupling = h1 > 0 ? (((h2 - h1) / h1) * 100).toFixed(1) : 0;

  return {
    chartData,
    avgHR: countHR ? Math.round(totalHR / countHR) : 0,
    decoupling,
    recordsCount: records.length,
    totalDist: records[records.length-1]?.distance || 0
  };
};

export default function App() {
  const [status, setStatus] = useState('IDLE'); 
  const [dashboardData, setDashboardData] = useState(null);
  const [csvContent, setCsvContent] = useState(null);
  const [fileName, setFileName] = useState("");

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setStatus('PARSING');
    setDashboardData(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const fitParser = new FitParser({
        force: true, 
        speedUnit: 'km/h', 
        lengthUnit: 'km',
        elapsedRecordField: true
      });

      fitParser.parse(e.target.result, (error, data) => {
        if (error) {
          console.error(error);
          setStatus('ERROR');
          return;
        }

        const records = data.records || data.record || [];
        
        // 1. Procesar datos para visualización
        const processed = processFitData(records);
        setDashboardData(processed);

        // 2. Generar CSV para la IA
        let csv = "Timestamp,Distance_km,HeartRate_bpm,Cadence_spm,GCT_Balance_Left,Vert_Osc_mm\n";
        records.forEach(r => {
           const t = r.timestamp ? new Date(r.timestamp).toISOString() : "";
           csv += `${t},${r.distance},${r.heart_rate},${r.cadence},${r.stance_time_balance},${r.vertical_oscillation}\n`;
        });
        setCsvContent(csv);
        setStatus('SUCCESS');
      });
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadCSV = () => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    saveAs(blob, `M55_RAW_${fileName}.csv`);
  };

  // Tooltip personalizado para gráficas
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: 'rgba(21, 22, 33, 0.95)', border: '1px solid #334155', padding: '10px', fontSize: '12px' }}>
          <p style={{color: '#94a3b8'}}>Km {label}</p>
          {payload.map((p, i) => (
            <div key={i} style={{ color: p.color }}>
              {p.name}: <b>{p.value}</b> {p.unit}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: STYLES.bg, color: STYLES.text, fontFamily: 'sans-serif', paddingBottom: '40px' }}>
      
      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${STYLES.border}`, padding: '20px', backgroundColor: 'rgba(11,12,21,0.9)', position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(5px)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '900', fontStyle: 'italic', margin: 0 }}>
              M55 <span style={{ color: STYLES.neonBlue }}>TELEMETRY</span>
            </h1>
            <p style={{ fontSize: '10px', color: STYLES.textDim, fontWeight: 'bold', letterSpacing: '1px' }}>
              VISUALIZADOR FIT NATIVO
            </p>
          </div>
          <div style={{ fontSize: '12px', color: STYLES.textDim }}>
             {status === 'SUCCESS' ? '✅ ANÁLISIS COMPLETADO' : 'ESPERANDO ARCHIVO...'}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>

        {/* 1. DROPZONE (Siempre visible si no hay datos, o arriba pequeña si ya hay) */}
        {status !== 'SUCCESS' && (
          <div style={{ 
            border: `2px dashed ${STYLES.border}`, borderRadius: '16px', backgroundColor: STYLES.card,
            padding: '60px', textAlign: 'center', marginBottom: '40px', position: 'relative'
          }}>
            <input type="file" accept=".fit" onChange={handleFileUpload} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
            <UploadCloud size={48} color={STYLES.neonBlue} style={{ marginBottom: '16px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>Arrastra tu archivo .FIT de Garmin</h3>
            <p style={{ color: STYLES.textDim, fontSize: '12px', marginTop: '8px' }}>Procesamiento local seguro</p>
          </div>
        )}

        {/* 2. DASHBOARD VISUAL (Solo si hay éxito) */}
        {status === 'SUCCESS' && dashboardData && (
          <div style={{ animation: 'fadeIn 0.5s' }}>
            
            {/* KPI CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
              <div style={{ backgroundColor: STYLES.card, border: `1px solid ${STYLES.border}`, padding: '20px', borderRadius: '12px' }}>
                <div style={{ fontSize: '10px', color: STYLES.textDim, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={12} /> DISTANCIA
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                  {(dashboardData.totalDist / 1000).toFixed(2)} <span style={{fontSize:'12px', color:STYLES.textDim}}>km</span>
                </div>
              </div>

              <div style={{ backgroundColor: STYLES.card, border: `1px solid ${STYLES.border}`, padding: '20px', borderRadius: '12px' }}>
                <div style={{ fontSize: '10px', color: STYLES.textDim, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Heart size={12} color={STYLES.neonRed} /> FC MEDIA
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace', color: STYLES.neonRed }}>
                  {dashboardData.avgHR} <span style={{fontSize:'12px', color:STYLES.textDim}}>ppm</span>
                </div>
              </div>

              <div style={{ backgroundColor: STYLES.card, border: `1px solid ${STYLES.border}`, padding: '20px', borderRadius: '12px' }}>
                <div style={{ fontSize: '10px', color: STYLES.textDim, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Zap size={12} color={STYLES.neonAmber} /> DRIFT / DESACOPLE
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace', color: dashboardData.decoupling > 5 ? STYLES.neonRed : STYLES.neonGreen }}>
                  {dashboardData.decoupling}%
                </div>
                <div style={{ fontSize: '10px', color: STYLES.textDim, marginTop: '4px' }}>
                   {dashboardData.decoupling > 5 ? '⚠️ Pérdida de eficiencia' : '✅ Motor estable'}
                </div>
              </div>
            </div>

            {/* GRÁFICAS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* GRÁFICA 1: FISIOLOGÍA (PULSO) */}
              <div style={{ backgroundColor: STYLES.card, border: `1px solid ${STYLES.border}`, padding: '20px', borderRadius: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Heart size={16} color={STYLES.neonRed} /> RESPUESTA CARDÍACA
                </h3>
                <div style={{ height: '250px', width: '100%' }}>
                  <ResponsiveContainer>
                    <AreaChart data={dashboardData.chartData}>
                      <defs>
                        <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={STYLES.neonRed} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={STYLES.neonRed} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={STYLES.grid} opacity={0.3} vertical={false} />
                      <XAxis dataKey="dist" stroke={STYLES.textDim} fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis domain={['dataMin - 5', 'auto']} stroke={STYLES.textDim} fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="hr" stroke={STYLES.neonRed} fill="url(#colorHr)" strokeWidth={2} name="Pulso" unit="ppm" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* GRÁFICA 2: GCT BALANCE (SÓLEO) */}
              <div style={{ backgroundColor: STYLES.card, border: `1px solid ${STYLES.border}`, padding: '20px', borderRadius: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Footprints size={16} color={STYLES.neonGreen} /> SIMETRÍA (GCT BALANCE IZQ)
                </h3>
                <div style={{ height: '250px', width: '100%' }}>
                  <ResponsiveContainer>
                    <LineChart data={dashboardData.chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={STYLES.grid} opacity={0.3} vertical={false} />
                      <XAxis dataKey="dist" stroke={STYLES.textDim} fontSize={10} tickLine={false} axisLine={false} />
                      {/* Eje Y centrado en 50% para ver la desviación */}
                      <YAxis domain={[47, 53]} stroke={STYLES.textDim} fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      
                      {/* ZONAS DE REFERENCIA */}
                      <ReferenceLine y={50} stroke="#fff" strokeDasharray="3 3" opacity={0.5} label={{ value: 'Centro (50%)', position: 'right', fill: '#fff', fontSize: 10 }} />
                      <ReferenceLine y={49} stroke={STYLES.neonRed} strokeDasharray="5 5" label={{ value: 'Alarma Sóleo (<49%)', position: 'right', fill: STYLES.neonRed, fontSize: 10 }} />
                      
                      <Line type="monotone" dataKey="gct" stroke={STYLES.neonGreen} strokeWidth={2} dot={false} name="GCT Izq" unit="%" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p style={{ fontSize: '10px', color: STYLES.textDim, marginTop: '10px' }}>
                  * Si la línea verde cruza la línea roja discontinua hacia abajo, hay fatiga estructural en el lado izquierdo.
                </p>
              </div>

              {/* GRÁFICA 3: BIOMECÁNICA (CADENCIA) */}
              <div style={{ backgroundColor: STYLES.card, border: `1px solid ${STYLES.border}`, padding: '20px', borderRadius: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={16} color={STYLES.neonBlue} /> CADENCIA
                </h3>
                <div style={{ height: '150px', width: '100%' }}>
                  <ResponsiveContainer>
                    <LineChart data={dashboardData.chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={STYLES.grid} opacity={0.3} vertical={false} />
                      <XAxis dataKey="dist" stroke={STYLES.textDim} fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis domain={['auto', 'auto']} stroke={STYLES.textDim} fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="cadence" stroke={STYLES.neonBlue} strokeWidth={2} dot={false} name="Cadencia" unit="spm" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* 3. BOTÓN DE DESCARGA FINAL */}
            <div style={{ marginTop: '40px', padding: '20px', backgroundColor: 'rgba(0, 242, 255, 0.05)', borderRadius: '12px', border: `1px solid ${STYLES.neonBlue}` }}>
              <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: STYLES.neonBlue, marginBottom: '10px' }}>
                ¿TODO LISTO PARA EL ANÁLISIS IA?
              </h4>
              <p style={{ fontSize: '12px', color: STYLES.textDim, marginBottom: '16px' }}>
                Descarga el archivo CSV enriquecido y pásaselo a tu Asistente para generar el JSON de diagnóstico.
              </p>
              <button 
                onClick={downloadCSV}
                style={{ 
                  width: '100%', backgroundColor: STYLES.neonBlue, color: '#0b0c15', 
                  fontWeight: '900', padding: '16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
                }}
              >
                <FileText size={18} /> DESCARGAR CSV ENRIQUECIDO
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}