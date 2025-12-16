import React, { useState } from 'react';
import FitParser from 'fit-file-parser'; 
import { saveAs } from 'file-saver';     
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area
} from 'recharts';
import { 
  UploadCloud, Activity, Heart, Zap, Footprints, FileText, 
  ArrowRight, Mountain, Gauge, Ruler
} from 'lucide-react';

// --- ESTILOS "M55 DARK" ---
const STYLES = {
  bg: '#0b0c15',
  card: '#151621',
  border: '#1e293b',
  text: '#e2e8f0',
  textDim: '#64748b',
  neonBlue: '#00f2ff',   // Pace
  neonGreen: '#00ff9d',  // GCT
  neonRed: '#ff0055',    // HR
  neonAmber: '#ffb700',  // Power
  neonPurple: '#d946ef', // Vert Osc
  neonOrange: '#f97316', // Stride
  grid: '#334155'
};

// --- LOGICA MATEMÁTICA AVANZADA ---
const calculateMetrics = (records) => {
  if (!records || records.length === 0) return null;

  // 1. Filtrado y Limpieza
  const cleanRecords = records.filter(r => r.distance != null && !isNaN(r.distance));
  const step = cleanRecords.length > 2000 ? Math.floor(cleanRecords.length / 1000) : 1;
  
  const chartData = [];
  let totalHR = 0, countHR = 0;
  let maxDistVal = 0;
  
  // Detectores de disponibilidad de datos
  let hasAltitude = false;
  let hasPower = false;
  let hasVertOsc = false;

  // Variables para suavizado de Ritmo (Media Móvil)
  // Usamos una ventana de 5 puntos para que el ritmo no sea un diente de sierra loco
  const paceWindow = []; 

  for (let i = 0; i < cleanRecords.length; i++) {
    const r = cleanRecords[i];
    
    // Acumuladores KPI
    if (r.heart_rate) { totalHR += r.heart_rate; countHR++; }
    if (r.altitude && r.altitude !== 0) hasAltitude = true;
    if (r.power && r.power !== 0) hasPower = true;
    if (r.vertical_oscillation && r.vertical_oscillation !== 0) hasVertOsc = true;

    // Distancia Máxima
    let dKm = r.distance; // fit-parser config gives km
    if (dKm > maxDistVal) maxDistVal = dKm;

    // --- CÁLCULO DE RITMO (PACE) ---
    // Si no tenemos speed directa, la calculamos por delta de distancia/tiempo
    // Speed (m/s) = DeltaDist (km) * 1000 / DeltaTime (s)
    let speedMps = 0;
    if (i > 0) {
       const prev = cleanRecords[i-1];
       const dDist = (r.distance - prev.distance) * 1000; // metros
       const dTime = (new Date(r.timestamp) - new Date(prev.timestamp)) / 1000; // segundos
       if (dTime > 0) speedMps = dDist / dTime;
    } else {
       speedMps = r.speed ? (r.speed * 1000 / 3600) : 0; // fallback si existe speed field
    }

    // Suavizado de ritmo
    paceWindow.push(speedMps);
    if (paceWindow.length > 5) paceWindow.shift();
    const avgSpeedMps = paceWindow.reduce((a,b)=>a+b,0) / paceWindow.length;

    // Convertir m/s a min/km
    let paceMinKm = 0;
    if (avgSpeedMps > 0.5) { // Filtrar paradas
       const minPerKm = 16.666666 / avgSpeedMps;
       paceMinKm = minPerKm;
    }

    // --- CÁLCULO DE ZANCADA (STRIDE LENGTH) ---
    // Stride (m) = Speed (m/min) / Cadence (spm)
    let strideLen = 0;
    if (r.cadence > 0 && avgSpeedMps > 0) {
      strideLen = (avgSpeedMps * 60) / r.cadence;
    }

    // Guardar Punto para Gráfica (Solo cada X puntos para rendimiento)
    if (i % step === 0) {
      chartData.push({
        dist: parseFloat(dKm.toFixed(3)), 
        hr: r.heart_rate,
        cadence: r.cadence,
        gct: r.stance_time_balance, 
        vertOsc: r.vertical_oscillation,
        alt: r.altitude,
        pwr: r.power,
        pace: paceMinKm > 0 && paceMinKm < 20 ? parseFloat(paceMinKm.toFixed(2)) : null, // Filtro picos locos
        stride: strideLen > 0 && strideLen < 3 ? parseFloat(strideLen.toFixed(2)) : null
      });
    }
  }

  // Generador de Ticks Eje X
  const xTicks = [];
  const limit = Math.ceil(maxDistVal);
  const tickStep = limit > 20 ? Math.ceil(limit / 20) : 1;
  for (let i = 0; i <= limit; i += tickStep) xTicks.push(i);

  // Desacople
  const mid = Math.floor(cleanRecords.length / 2);
  const h1 = cleanRecords.slice(0, mid).reduce((a,b) => a + (b.heart_rate||0), 0) / mid;
  const h2 = cleanRecords.slice(mid).reduce((a,b) => a + (b.heart_rate||0), 0) / (cleanRecords.length - mid);
  const decoupling = h1 > 0 ? (((h2 - h1) / h1) * 100).toFixed(1) : 0;

  return {
    chartData,
    xTicks,
    avgHR: countHR ? Math.round(totalHR / countHR) : 0,
    decoupling,
    totalDist: maxDistVal,
    availability: { hasAltitude, hasPower, hasVertOsc }
  };
};

// Formateador de tiempo para tooltips (ej: 5.5 min/km -> 5:30)
const formatPace = (val) => {
  if (!val) return "--";
  const min = Math.floor(val);
  const sec = Math.round((val - min) * 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

export default function App() {
  const [status, setStatus] = useState('IDLE'); 
  const [data, setData] = useState(null);
  const [csvContent, setCsvContent] = useState(null);
  const [fileName, setFileName] = useState("");

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setStatus('PARSING');
    setData(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const fitParser = new FitParser({
        force: true, speedUnit: 'km/h', lengthUnit: 'km', elapsedRecordField: true
      });

      fitParser.parse(e.target.result, (error, resultData) => {
        if (error) { setStatus('ERROR'); return; }

        const records = resultData.records || resultData.record || [];
        const processed = calculateMetrics(records);
        setData(processed);

        // CSV Full Export
        let csv = "Timestamp,Dist_km,HR,Cadence,GCT_Left,VertOsc_mm,Power_W,Alt_m,Speed_mps\n";
        records.forEach(r => {
           const t = r.timestamp ? new Date(r.timestamp).toISOString() : "";
           csv += `${t},${r.distance},${r.heart_rate},${r.cadence},${r.stance_time_balance},${r.vertical_oscillation},${r.power},${r.altitude},${r.speed}\n`;
        });
        setCsvContent(csv);
        setStatus('SUCCESS');
      });
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadCSV = () => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    saveAs(blob, `M55_FULL_${fileName}.csv`);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: 'rgba(21, 22, 33, 0.95)', border: '1px solid #334155', padding: '10px', fontSize: '12px', zIndex: 100 }}>
          <p style={{color: '#94a3b8', borderBottom: '1px solid #334155', paddingBottom: '4px', marginBottom: '8px'}}>
            Km {Number(label).toFixed(2)}
          </p>
          {payload.map((p, i) => (
            <div key={i} style={{ color: p.color, marginBottom: '2px' }}>
              {p.name}: <b>{p.name === 'Ritmo' ? formatPace(p.value) : p.value}</b> {p.unit}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Componente de Gráfica Reutilizable
  const ChartSection = ({ title, icon: Icon, dataKey, color, unit, domain, type="line", yReversed=false }) => (
    <div style={{ backgroundColor: STYLES.card, border: `1px solid ${STYLES.border}`, padding: '20px', borderRadius: '12px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Icon size={16} color={color} /> {title}
      </h3>
      <div style={{ height: '200px', width: '100%' }}>
        <ResponsiveContainer>
          {type === 'area' ? (
             <AreaChart data={data.chartData}>
               <CartesianGrid strokeDasharray="3 3" stroke={STYLES.grid} opacity={0.3} vertical={false} />
               <XAxis dataKey="dist" type="number" domain={[0, 'dataMax']} ticks={data.xTicks} stroke={STYLES.textDim} fontSize={12} tickLine={false} axisLine={false} />
               <YAxis domain={domain || ['auto', 'auto']} stroke={STYLES.textDim} fontSize={10} tickLine={false} axisLine={false} />
               <Tooltip content={<CustomTooltip />} />
               <Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.2} strokeWidth={2} name={title} unit={unit} />
             </AreaChart>
          ) : (
             <LineChart data={data.chartData}>
               <CartesianGrid strokeDasharray="3 3" stroke={STYLES.grid} opacity={0.3} vertical={false} />
               <XAxis dataKey="dist" type="number" domain={[0, 'dataMax']} ticks={data.xTicks} stroke={STYLES.textDim} fontSize={12} tickLine={false} axisLine={false} />
               <YAxis domain={domain || ['auto', 'auto']} reversed={yReversed} stroke={STYLES.textDim} fontSize={10} tickLine={false} axisLine={false} />
               <Tooltip content={<CustomTooltip />} />
               {/* Líneas de Referencia Especiales */}
               {dataKey === 'gct' && <ReferenceLine y={49} stroke={STYLES.neonRed} strokeDasharray="5 5" />}
               {dataKey === 'gct' && <ReferenceLine y={50} stroke="#fff" strokeDasharray="3 3" opacity={0.5} />}
               
               <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} name={title} unit={unit} />
             </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: STYLES.bg, color: STYLES.text, fontFamily: 'sans-serif', paddingBottom: '40px' }}>
      
      {/* HEADER */}
      <div style={{ borderBottom: `1px solid ${STYLES.border}`, padding: '20px', backgroundColor: 'rgba(11,12,21,0.9)', position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(5px)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '900', fontStyle: 'italic', margin: 0 }}>
              M55 <span style={{ color: STYLES.neonBlue }}>PRO ANALYZER</span>
            </h1>
          </div>
          <div style={{ fontSize: '12px', color: STYLES.textDim }}>{status === 'SUCCESS' ? '✅ FIT DECODED' : 'READY'}</div>
        </div>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>

        {status !== 'SUCCESS' && (
          <div style={{ border: `2px dashed ${STYLES.border}`, borderRadius: '16px', backgroundColor: STYLES.card, padding: '60px', textAlign: 'center', marginBottom: '40px', position: 'relative' }}>
            <input type="file" accept=".fit" onChange={handleFileUpload} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
            <UploadCloud size={48} color={STYLES.neonBlue} style={{ marginBottom: '16px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>Arrastra tu archivo .FIT</h3>
            <p style={{ color: STYLES.textDim, fontSize: '12px', marginTop: '8px' }}>El sistema extraerá todas las gráficas disponibles</p>
          </div>
        )}

        {status === 'SUCCESS' && data && (
          <div style={{ animation: 'fadeIn 0.5s', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* KPI GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div style={{ backgroundColor: STYLES.card, border: `1px solid ${STYLES.border}`, padding: '20px', borderRadius: '12px' }}>
                <div style={{ fontSize: '10px', color: STYLES.textDim, fontWeight: 'bold' }}>DISTANCIA</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace' }}>{data.totalDist.toFixed(2)} km</div>
              </div>
              <div style={{ backgroundColor: STYLES.card, border: `1px solid ${STYLES.border}`, padding: '20px', borderRadius: '12px' }}>
                <div style={{ fontSize: '10px', color: STYLES.textDim, fontWeight: 'bold' }}>FC MEDIA</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace', color: STYLES.neonRed }}>{data.avgHR} ppm</div>
              </div>
              <div style={{ backgroundColor: STYLES.card, border: `1px solid ${STYLES.border}`, padding: '20px', borderRadius: '12px' }}>
                <div style={{ fontSize: '10px', color: STYLES.textDim, fontWeight: 'bold' }}>DESACOPLE</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace', color: data.decoupling > 5 ? STYLES.neonRed : STYLES.neonGreen }}>{data.decoupling}%</div>
              </div>
            </div>

            {/* GRÁFICAS DINÁMICAS */}
            
            {/* 1. RITMO (PACE) - Siempre útil */}
            <ChartSection title="Ritmo (min/km)" icon={Gauge} dataKey="pace" color={STYLES.neonBlue} unit="min/km" domain={[4, 10]} yReversed={true} />

            {/* 2. PULSO - Siempre útil */}
            <ChartSection title="Frecuencia Cardíaca" icon={Heart} dataKey="hr" color={STYLES.neonRed} unit="ppm" domain={['dataMin - 5', 'auto']} type="area" />

            {/* 3. SIMETRÍA - Clave M55 */}
            <ChartSection title="Simetría Sóleo (GCT Izq)" icon={Footprints} dataKey="gct" color={STYLES.neonGreen} unit="%" domain={[47, 53]} />

            {/* 4. CADENCIA */}
            <ChartSection title="Cadencia" icon={Activity} dataKey="cadence" color={STYLES.text} unit="spm" />

            {/* 5. OSCILACIÓN VERTICAL - Si existe */}
            {data.availability.hasVertOsc && (
              <ChartSection title="Oscilación Vertical" icon={ArrowRight} dataKey="vertOsc" color={STYLES.neonPurple} unit="mm" />
            )}

            {/* 6. ZANCADA - Calculada */}
            <ChartSection title="Longitud de Zancada" icon={Ruler} dataKey="stride" color={STYLES.neonOrange} unit="m" domain={[0.5, 1.5]} />

            {/* 7. ALTITUD - Si existe */}
            {data.availability.hasAltitude && (
              <ChartSection title="Perfil de Elevación" icon={Mountain} dataKey="alt" color={STYLES.textDim} unit="m" type="area" />
            )}

            {/* 8. POTENCIA - Si existe */}
            {data.availability.hasPower && (
              <ChartSection title="Potencia" icon={Zap} dataKey="pwr" color={STYLES.neonAmber} unit="w" />
            )}

            {/* BOTÓN DESCARGA */}
            <div style={{ marginTop: '20px', padding: '20px', backgroundColor: 'rgba(0, 242, 255, 0.05)', borderRadius: '12px', border: `1px solid ${STYLES.neonBlue}` }}>
              <button onClick={downloadCSV} style={{ width: '100%', backgroundColor: STYLES.neonBlue, color: '#0b0c15', fontWeight: '900', padding: '16px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} /> DESCARGAR CSV TOTAL
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}