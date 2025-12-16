import React, { useState } from 'react';
import FitParser from 'fit-file-parser'; 
import { saveAs } from 'file-saver';     
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area, Brush
} from 'recharts';
import { 
  UploadCloud, Activity, Heart, Zap, Footprints, FileText, 
  ArrowRight, Mountain, Gauge, Ruler, PlusCircle, Map, Percent, Timer, Maximize2, X
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
  neonCyan: '#22d3ee',
  grid: '#334155'
};

// --- UTILIDADES GEOMÉTRICAS (GPX) ---
const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const parseGpxString = (gpxStr) => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(gpxStr, "text/xml");
  const trkpts = xmlDoc.getElementsByTagName("trkpt");
  const elevationData = [];
  let totalDist = 0;
  for (let i = 0; i < trkpts.length; i++) {
    const pt = trkpts[i];
    const lat = parseFloat(pt.getAttribute("lat"));
    const lon = parseFloat(pt.getAttribute("lon"));
    const ele = parseFloat(pt.getElementsByTagName("ele")[0]?.textContent || 0);
    if (i > 0) {
      const prev = trkpts[i-1];
      const prevLat = parseFloat(prev.getAttribute("lat"));
      const prevLon = parseFloat(prev.getAttribute("lon"));
      totalDist += getDistanceFromLatLonInKm(prevLat, prevLon, lat, lon);
    }
    if (i % 5 === 0 || i === trkpts.length - 1) {
        elevationData.push({ dist: parseFloat(totalDist.toFixed(3)), alt: parseFloat(ele.toFixed(1)) });
    }
  }
  return elevationData;
};

// --- LOGICA MATEMÁTICA AVANZADA FIT ---
const calculateMetrics = (records) => {
  if (!records || records.length === 0) return null;
  const cleanRecords = records.filter(r => r.distance != null && !isNaN(r.distance));
  const step = cleanRecords.length > 2000 ? Math.floor(cleanRecords.length / 1000) : 1;
  const chartData = [];
  let totalHR = 0, countHR = 0, maxDistVal = 0;
  let hasPower = false, hasVertOsc = false, hasAltitude = false, hasGCT_ms = false;

  for (let i = 0; i < cleanRecords.length; i++) {
    const r = cleanRecords[i];
    if (r.heart_rate) { totalHR += r.heart_rate; countHR++; }
    if (r.vertical_oscillation) hasVertOsc = true;
    if (r.stance_time) hasGCT_ms = true;

    let pwrVal = r.RP_Power || r.power; 
    if (pwrVal && pwrVal > 0) hasPower = true;

    let altVal = r.enhanced_altitude || r.altitude;
    if (altVal !== undefined) hasAltitude = true;

    let speedVal = r.enhanced_speed || r.speed; 
    let speedKmh = speedVal < 7 ? speedVal * 3.6 : speedVal;

    let dKm = r.distance; 
    if (dKm > maxDistVal) maxDistVal = dKm;

    let paceMinKm = speedKmh > 1 ? 60 / speedKmh : 0;
    let realCadence = (r.cadence > 0 && r.cadence < 120) ? r.cadence * 2 : r.cadence;
    
    let strideLen = 0;
    if (r.step_length && r.step_length > 0) strideLen = r.step_length / 1000;
    else if (realCadence > 0 && speedKmh > 0) strideLen = (speedKmh * 1000 / 60) / realCadence;

    let vertRatio = r.vertical_ratio;
    if (!vertRatio && hasVertOsc && strideLen > 0 && r.vertical_oscillation > 0) {
        vertRatio = (r.vertical_oscillation / (strideLen * 1000)) * 100;
    }

    if (i % step === 0) {
      chartData.push({
        dist: parseFloat(dKm.toFixed(3)), 
        hr: r.heart_rate,
        cadence: realCadence, 
        gct: r.stance_time_balance, 
        gct_ms: r.stance_time,
        vertOsc: r.vertical_oscillation,
        vRatio: vertRatio,
        pwr: pwrVal, 
        pace: paceMinKm > 0 && paceMinKm < 20 ? parseFloat(paceMinKm.toFixed(2)) : null, 
        stride: strideLen > 0 && strideLen < 3 ? parseFloat(strideLen.toFixed(2)) : null,
        alt: altVal
      });
    }
  }

  const xTicks = [];
  const limit = Math.ceil(maxDistVal);
  const tickStep = limit > 20 ? Math.ceil(limit / 20) : 1;
  for (let i = 0; i <= limit; i += tickStep) xTicks.push(i);

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
    availability: { hasPower, hasVertOsc, hasAltitude, hasGCT_ms }
  };
};

const formatPace = (val) => {
  if (!val) return "--";
  const min = Math.floor(val);
  const sec = Math.round((val - min) * 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

export default function App() {
  const [status, setStatus] = useState('IDLE'); 
  const [data, setData] = useState(null);
  const [gpxData, setGpxData] = useState(null); 
  const [csvContent, setCsvContent] = useState(null);
  const [fileName, setFileName] = useState("");
  
  // --- ESTADO PARA LA PANTALLA COMPLETA ---
  const [activeChart, setActiveChart] = useState(null); 

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setStatus('PARSING');
    setData(null);
    setGpxData(null);

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
        
        let csv = "Timestamp,Dist_km,HR,Cadence_SPM,GCT_Left_Pct,GCT_Time_ms,VertOsc_mm,VertRatio_Pct,Stride_m,Power_W,Alt_m,Speed_kmh\n";
        records.forEach(r => {
           let cad = (r.cadence > 0 && r.cadence < 120) ? r.cadence * 2 : r.cadence;
           let pwr = r.RP_Power || r.power;
           let spd = r.enhanced_speed || r.speed;
           let alt = r.enhanced_altitude || r.altitude;
           let vr = r.vertical_ratio;
           let step = r.step_length ? r.step_length/1000 : 0;
           const t = r.timestamp ? new Date(r.timestamp).toISOString() : "";
           csv += `${t},${r.distance},${r.heart_rate},${cad},${r.stance_time_balance},${r.stance_time},${r.vertical_oscillation},${vr},${step},${pwr},${alt},${spd}\n`;
        });
        setCsvContent(csv);
        setStatus('SUCCESS');
      });
    };
    reader.readAsArrayBuffer(file);
  };

  const handleGpxUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        setGpxData(parseGpxString(e.target.result));
    };
    reader.readAsText(file);
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

  // --- MODAL DE PANTALLA COMPLETA CON ZOOM (BRUSH) ---
  const FullScreenModal = ({ chartConfig, data, xTicks, onClose }) => {
    const isMobile = window.innerWidth < 768;
    
    const mobileLandscapeStyle = isMobile ? {
        transform: 'rotate(90deg)',
        width: '100vh',
        height: '100vw',
        position: 'absolute',
        top: '50%',
        left: '50%',
        translate: '-50% -50%',
    } : {
        width: '100%',
        height: '100%'
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: '#000', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
            
            <div style={{ ...mobileLandscapeStyle, display: 'flex', flexDirection: 'column', padding: '20px', boxSizing: 'border-box', backgroundColor: '#000' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h2 style={{ color: chartConfig.color, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <chartConfig.icon /> {chartConfig.title} 
                        <span style={{fontSize: '12px', color: STYLES.textDim}}>(ZOOM ACTIVADO)</span>
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '10px' }}>
                        <X size={32} />
                    </button>
                </div>

                <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                    {chartConfig.type === 'area' ? (
                        <AreaChart data={chartConfig.dataset || data}>
                            <CartesianGrid strokeDasharray="3 3" stroke={STYLES.grid} opacity={0.3} vertical={false} />
                            <XAxis dataKey="dist" type="number" domain={[0, 'dataMax']} ticks={xTicks} stroke={STYLES.textDim} fontSize={14} tickLine={false} axisLine={false} />
                            <YAxis domain={chartConfig.domain || ['auto', 'auto']} stroke={STYLES.textDim} fontSize={14} tickLine={false} axisLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey={chartConfig.dataKey} stroke={chartConfig.color} fill={chartConfig.color} fillOpacity={0.2} strokeWidth={3} name={chartConfig.title} unit={chartConfig.unit} />
                            
                            {/* --- ZOOM CONTROL --- */}
                            <Brush 
                                dataKey="dist" 
                                height={40} 
                                stroke={chartConfig.color} 
                                fill="#151621"
                                tickFormatter={(val) => val.toFixed(1)}
                            />

                        </AreaChart>
                    ) : (
                        <LineChart data={chartConfig.dataset || data}>
                            <CartesianGrid strokeDasharray="3 3" stroke={STYLES.grid} opacity={0.3} vertical={false} />
                            <XAxis dataKey="dist" type="number" domain={[0, 'dataMax']} ticks={xTicks} stroke={STYLES.textDim} fontSize={14} tickLine={false} axisLine={false} />
                            <YAxis domain={chartConfig.domain || ['auto', 'auto']} reversed={chartConfig.yReversed} stroke={STYLES.textDim} fontSize={14} tickLine={false} axisLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            {chartConfig.dataKey === 'gct' && <ReferenceLine y={49} stroke={STYLES.neonRed} strokeDasharray="5 5" />}
                            {chartConfig.dataKey === 'gct' && <ReferenceLine y={50} stroke="#fff" strokeDasharray="3 3" opacity={0.5} />}
                            <Line type="monotone" dataKey={chartConfig.dataKey} stroke={chartConfig.color} strokeWidth={3} dot={false} name={chartConfig.title} unit={chartConfig.unit} />
                            
                            {/* --- ZOOM CONTROL --- */}
                            <Brush 
                                dataKey="dist" 
                                height={40} 
                                stroke={chartConfig.color} 
                                fill="#151621"
                                tickFormatter={(val) => val.toFixed(1)}
                            />

                        </LineChart>
                    )}
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
  };

  const ChartSection = (props) => (
    <div 
        onClick={() => setActiveChart(props)}
        style={{ 
            backgroundColor: STYLES.card, border: `1px solid ${STYLES.border}`, padding: '20px', borderRadius: '12px', 
            cursor: 'pointer', transition: 'transform 0.2s', position: 'relative' 
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = props.color}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = STYLES.border}
    >
      <div style={{ position: 'absolute', top: '20px', right: '20px', color: STYLES.textDim }}>
          <Maximize2 size={16} />
      </div>
      <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <props.icon size={16} color={props.color} /> {props.title}
      </h3>
      <div style={{ height: '200px', width: '100%', pointerEvents: 'none' }}> 
        <ResponsiveContainer>
          {props.type === 'area' ? (
             <AreaChart data={props.dataset || data.chartData}>
               <CartesianGrid strokeDasharray="3 3" stroke={STYLES.grid} opacity={0.3} vertical={false} />
               <XAxis dataKey="dist" type="number" domain={[0, 'dataMax']} ticks={data.xTicks} stroke={STYLES.textDim} fontSize={12} tickLine={false} axisLine={false} />
               <YAxis domain={props.domain || ['auto', 'auto']} stroke={STYLES.textDim} fontSize={10} tickLine={false} axisLine={false} />
               <Area type="monotone" dataKey={props.dataKey} stroke={props.color} fill={props.color} fillOpacity={0.2} strokeWidth={2} isAnimationActive={false} />
             </AreaChart>
          ) : (
             <LineChart data={props.dataset || data.chartData}>
               <CartesianGrid strokeDasharray="3 3" stroke={STYLES.grid} opacity={0.3} vertical={false} />
               <XAxis dataKey="dist" type="number" domain={[0, 'dataMax']} ticks={data.xTicks} stroke={STYLES.textDim} fontSize={12} tickLine={false} axisLine={false} />
               <YAxis domain={props.domain || ['auto', 'auto']} reversed={props.yReversed} stroke={STYLES.textDim} fontSize={10} tickLine={false} axisLine={false} />
               {props.dataKey === 'gct' && <ReferenceLine y={49} stroke={STYLES.neonRed} strokeDasharray="5 5" />}
               <Line type="monotone" dataKey={props.dataKey} stroke={props.color} strokeWidth={2} dot={false} isAnimationActive={false} />
             </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: STYLES.bg, color: STYLES.text, fontFamily: 'sans-serif', paddingBottom: '40px' }}>
      
      {activeChart && (
          <FullScreenModal 
            chartConfig={activeChart} 
            data={activeChart.dataset || data.chartData} 
            xTicks={data.xTicks} 
            onClose={() => setActiveChart(null)} 
          />
      )}

      <div style={{ borderBottom: `1px solid ${STYLES.border}`, padding: '20px', backgroundColor: 'rgba(11,12,21,0.9)', position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(5px)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '900', fontStyle: 'italic', margin: 0 }}>
              M55 <span style={{ color: STYLES.neonBlue }}>FUSION DASHBOARD</span>
            </h1>
          </div>
          <div style={{ fontSize: '12px', color: STYLES.textDim }}>{status === 'SUCCESS' ? '✅ FIT LOADED' : 'READY'}</div>
        </div>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>

        {status !== 'SUCCESS' && (
          <div style={{ border: `2px dashed ${STYLES.border}`, borderRadius: '16px', backgroundColor: STYLES.card, padding: '60px', textAlign: 'center', marginBottom: '40px', position: 'relative' }}>
            <input type="file" accept=".fit" onChange={handleFileUpload} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
            <UploadCloud size={48} color={STYLES.neonBlue} style={{ marginBottom: '16px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>Arrastra tu archivo .FIT</h3>
            <p style={{ color: STYLES.textDim, fontSize: '12px', marginTop: '8px' }}>Paso 1: Carga la telemetría base</p>
          </div>
        )}

        {status === 'SUCCESS' && data && (
          <div style={{ animation: 'fadeIn 0.5s', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
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

            {!gpxData && !data.availability.hasAltitude && (
                <div style={{ border: `1px dashed ${STYLES.border}`, borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', position: 'relative', cursor: 'pointer', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <input type="file" accept=".gpx" onChange={handleGpxUpload} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                    <Map size={24} color={STYLES.textDim} />
                    <div>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>¿Falta el Perfil? Añadir GPX</h4>
                        <p style={{ margin: 0, fontSize: '10px', color: STYLES.textDim }}>Arrastra aquí tu archivo .gpx para superponer la altimetría</p>
                    </div>
                    <PlusCircle size={20} color={STYLES.neonBlue} />
                </div>
            )}

            {gpxData ? (
                 <ChartSection title="Perfil de Elevación (Fuente: GPX)" icon={Mountain} dataset={gpxData} dataKey="alt" color={STYLES.text} unit="m" type="area" />
            ) : (data.availability.hasAltitude ? (
                 <ChartSection title="Perfil de Elevación" icon={Mountain} dataset={data.chartData} dataKey="alt" color={STYLES.text} unit="m" type="area" />
            ) : null)}

            <ChartSection title="Ritmo (min/km)" icon={Gauge} dataset={data.chartData} dataKey="pace" color={STYLES.neonBlue} unit="min/km" domain={[4, 10]} yReversed={true} />
            <ChartSection title="Frecuencia Cardíaca" icon={Heart} dataset={data.chartData} dataKey="hr" color={STYLES.neonRed} unit="ppm" domain={['dataMin - 5', 'auto']} type="area" />
            
            <ChartSection title="Simetría Sóleo (GCT Balance Izq)" icon={Footprints} dataset={data.chartData} dataKey="gct" color={STYLES.neonGreen} unit="%" domain={[47, 53]} />
            
            {data.availability.hasGCT_ms && (
              <ChartSection title="Tiempo de Contacto Suelo (GCT)" icon={Timer} dataset={data.chartData} dataKey="gct_ms" color={STYLES.neonCyan} unit="ms" domain={['dataMin - 10', 'dataMax + 10']} />
            )}

            <ChartSection title="Cadencia (SPM)" icon={Activity} dataset={data.chartData} dataKey="cadence" color={STYLES.text} unit="spm" domain={[140, 200]} />
            
            {data.availability.hasVertOsc && (
              <>
                 <ChartSection title="Oscilación Vertical" icon={ArrowRight} dataset={data.chartData} dataKey="vertOsc" color={STYLES.neonPurple} unit="mm" />
                 <ChartSection title="Ratio Vertical (%)" icon={Percent} dataset={data.chartData} dataKey="vRatio" color={STYLES.neonMagenta} unit="%" domain={[0, 15]} />
              </>
            )}
             
            <ChartSection title="Longitud de Zancada" icon={Ruler} dataset={data.chartData} dataKey="stride" color={STYLES.neonOrange} unit="m" domain={[0.5, 1.5]} />

            {data.availability.hasPower && (
              <ChartSection title="Potencia (Watts)" icon={Zap} dataset={data.chartData} dataKey="pwr" color={STYLES.neonAmber} unit="w" />
            )}

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