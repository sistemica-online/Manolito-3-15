import React, { useState } from 'react';
import FitParser from 'fit-file-parser'; 
import { saveAs } from 'file-saver';     
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area, ReferenceArea
} from 'recharts';
import { 
  UploadCloud, Activity, Heart, Zap, Footprints, FileText, 
  ArrowRight, Mountain, Gauge, Ruler, PlusCircle, Map, Percent, Timer, Maximize2, X, RotateCcw
} from 'lucide-react';

// --- ESTILOS "POWER STATISTICS" (Clean & Minimal) ---
const STYLES = {
  bg: '#f8fafc',       // Gris muy claro
  card: '#ffffff',     // Blanco puro
  border: '#e2e8f0',   // Bordes sutiles
  text: '#0f172a',     // Slate 900 (Casi negro)
  textDim: '#64748b',  // Slate 500
  
  // Paleta de Datos Científica
  c_blue: '#2563eb',   
  c_red: '#dc2626',    
  c_green: '#16a34a',  
  c_amber: '#d97706',  
  c_purple: '#7c3aed', 
  c_grey: '#475569',   
  c_cyan: '#0891b2',   
  c_orange: '#ea580c', 
  
  grid: '#cbd5e1'      
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
    saveAs(blob, `POWER_STATS_${fileName}.csv`);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: 'white', border: '1px solid #ccc', padding: '10px', fontSize: '12px', zIndex: 100, boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
          <p style={{color: '#333', borderBottom: '1px solid #eee', paddingBottom: '4px', marginBottom: '8px'}}>
            Punto: <b>{Number(label).toFixed(3)} km</b>
          </p>
          {payload.map((p, i) => (
            <div key={i} style={{ color: p.color, marginBottom: '2px', fontWeight: '500' }}>
              {p.name}: <b>{p.name === 'Ritmo' ? formatPace(p.value) : p.value}</b> {p.unit}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const FullScreenModal = ({ chartConfig, data, xTicks, onClose }) => {
    const isMobile = window.innerWidth < 768;
    const [left, setLeft] = useState('dataMin');
    const [right, setRight] = useState('dataMax');
    const [refAreaLeft, setRefAreaLeft] = useState('');
    const [refAreaRight, setRefAreaRight] = useState('');

    const zoom = () => {
        if (refAreaLeft === refAreaRight || refAreaRight === '') {
            setRefAreaLeft(''); setRefAreaRight(''); return;
        }
        let min = refAreaLeft; let max = refAreaRight;
        if (min > max) [min, max] = [max, min];
        setLeft(min); setRight(max);
        setRefAreaLeft(''); setRefAreaRight('');
    };

    const zoomOut = () => { setLeft('dataMin'); setRight('dataMax'); };
    
    const mobileLandscapeStyle = isMobile ? {
        transform: 'rotate(90deg)', width: '100vh', height: '100vw',
        position: 'absolute', top: '50%', left: '50%', translate: '-50% -50%',
    } : { width: '100%', height: '100%' };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: '#f8fafc', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
            <div style={{ ...mobileLandscapeStyle, display: 'flex', flexDirection: 'column', padding: '20px', boxSizing: 'border-box', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <h2 style={{ color: STYLES.text, margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px' }}>
                            <chartConfig.icon size={20} color={chartConfig.color} /> {chartConfig.title} 
                        </h2>
                        {left !== 'dataMin' && (
                             <button onClick={zoomOut} style={{ backgroundColor: '#fff', border: `1px solid ${STYLES.border}`, color: STYLES.text, padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                <RotateCcw size={14} /> RESET
                             </button>
                        )}
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: STYLES.textDim, cursor: 'pointer', padding: '5px' }}>
                        <X size={28} />
                    </button>
                </div>
                
                <div style={{ textAlign: 'left', color: STYLES.textDim, fontSize: '12px', marginBottom: '8px' }}>
                    Selecciona un área para hacer ZOOM | Doble clic para RESET
                </div>

                <div style={{ flex: 1, minHeight: 0, userSelect: 'none', cursor: 'crosshair', backgroundColor: '#fff', borderRadius: '8px', border: `1px solid ${STYLES.border}`, padding: '10px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                        data={chartConfig.dataset || data}
                        onMouseDown={(e) => e && setRefAreaLeft(e.activeLabel)}
                        onMouseMove={(e) => refAreaLeft && e && setRefAreaRight(e.activeLabel)}
                        onMouseUp={zoom}
                        onDoubleClick={zoomOut}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke={STYLES.grid} opacity={0.5} />
                        <XAxis dataKey="dist" type="number" allowDataOverflow domain={[left, right]} stroke={STYLES.textDim} fontSize={12} tickLine={false} axisLine={true} />
                        <YAxis allowDataOverflow domain={chartConfig.domain || ['auto', 'auto']} reversed={chartConfig.yReversed} stroke={STYLES.textDim} fontSize={12} tickLine={false} axisLine={true} />
                        <Tooltip content={<CustomTooltip />} />
                        
                        {chartConfig.dataKey === 'gct' && <ReferenceLine y={50} stroke="#94a3b8" strokeDasharray="3 3" />}
                        
                        <Line type="monotone" dataKey={chartConfig.dataKey} stroke={chartConfig.color} strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} animationDuration={300} />
                        
                        {refAreaLeft && refAreaRight ? (
                            <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill={STYLES.text} fillOpacity={0.05} />
                        ) : null}
                    </LineChart>
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
            backgroundColor: STYLES.card, border: `1px solid ${STYLES.border}`, padding: '24px', borderRadius: '8px', 
            cursor: 'pointer', transition: 'all 0.2s', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; e.currentTarget.style.borderColor = STYLES.border; }}
    >
      <div style={{ position: 'absolute', top: '20px', right: '20px', color: STYLES.textDim }}>
          <Maximize2 size={18} />
      </div>
      <h3 style={{ fontSize: '14px', fontWeight: '700', color: STYLES.text, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.02em' }}>
        <props.icon size={18} color={props.color} /> {props.title.toUpperCase()}
      </h3>
      <div style={{ height: '180px', width: '100%', pointerEvents: 'none' }}> 
        <ResponsiveContainer>
          {props.type === 'area' ? (
             <AreaChart data={props.dataset || data.chartData}>
               <CartesianGrid strokeDasharray="3 3" stroke={STYLES.grid} opacity={0.5} vertical={false} />
               <XAxis dataKey="dist" type="number" domain={[0, 'dataMax']} ticks={data.xTicks} stroke={STYLES.textDim} fontSize={11} tickLine={false} axisLine={false} />
               <YAxis domain={props.domain || ['auto', 'auto']} stroke={STYLES.textDim} fontSize={11} tickLine={false} axisLine={false} />
               <Area type="monotone" dataKey={props.dataKey} stroke={props.color} fill={props.color} fillOpacity={0.1} strokeWidth={1.5} isAnimationActive={false} />
             </AreaChart>
          ) : (
             <LineChart data={props.dataset || data.chartData}>
               <CartesianGrid strokeDasharray="3 3" stroke={STYLES.grid} opacity={0.5} vertical={false} />
               <XAxis dataKey="dist" type="number" domain={[0, 'dataMax']} ticks={data.xTicks} stroke={STYLES.textDim} fontSize={11} tickLine={false} axisLine={false} />
               <YAxis domain={props.domain || ['auto', 'auto']} reversed={props.yReversed} stroke={STYLES.textDim} fontSize={11} tickLine={false} axisLine={false} />
               {props.dataKey === 'gct' && <ReferenceLine y={50} stroke="#cbd5e1" strokeDasharray="3 3" />}
               <Line type="monotone" dataKey={props.dataKey} stroke={props.color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
             </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: STYLES.bg, color: STYLES.text, fontFamily: 'sans-serif', paddingBottom: '60px' }}>
      
      {activeChart && (
          <FullScreenModal 
            chartConfig={activeChart} 
            data={activeChart.dataset || data.chartData} 
            xTicks={data.xTicks} 
            onClose={() => setActiveChart(null)} 
          />
      )}

      {/* HEADER POWER STATISTICS */}
      <div style={{ borderBottom: `1px solid ${STYLES.border}`, padding: '24px', backgroundColor: STYLES.card, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '-0.5px', margin: 0, color: STYLES.text }}>
              POWER STATISTICS
            </h1>
            <p style={{ fontSize: '11px', color: STYLES.textDim, fontWeight: '600', marginTop: '4px', letterSpacing: '0.5px' }}>
              PROFESSIONAL RUNNING ANALYTICS
            </p>
          </div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: status === 'SUCCESS' ? STYLES.c_green : STYLES.textDim }}>
             {status === 'SUCCESS' ? '● ONLINE' : '○ OFFLINE'}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '30px 20px' }}>

        {status !== 'SUCCESS' && (
          <div style={{ 
            border: `1px dashed ${STYLES.border}`, borderRadius: '12px', backgroundColor: STYLES.card,
            padding: '80px', textAlign: 'center', marginBottom: '40px', position: 'relative'
          }}>
            <input type="file" accept=".fit" onChange={handleFileUpload} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
            <div style={{ backgroundColor: '#eff6ff', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <UploadCloud size={28} color={STYLES.c_blue} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: STYLES.text }}>Cargar archivo .FIT</h3>
            <p style={{ color: STYLES.textDim, fontSize: '13px', marginTop: '8px' }}>Procesamiento local seguro</p>
          </div>
        )}

        {status === 'SUCCESS' && data && (
          <div style={{ animation: 'fadeIn 0.5s', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
              <div style={{ backgroundColor: STYLES.card, border: `1px solid ${STYLES.border}`, padding: '24px', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <div style={{ fontSize: '11px', color: STYLES.textDim, fontWeight: '700', letterSpacing: '0.5px', marginBottom: '8px' }}>DISTANCIA TOTAL</div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: STYLES.text, letterSpacing: '-1px' }}>{data.totalDist.toFixed(2)} <span style={{fontSize:'14px', fontWeight:'500', color:STYLES.textDim}}>km</span></div>
              </div>
              <div style={{ backgroundColor: STYLES.card, border: `1px solid ${STYLES.border}`, padding: '24px', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <div style={{ fontSize: '11px', color: STYLES.textDim, fontWeight: '700', letterSpacing: '0.5px', marginBottom: '8px' }}>FC MEDIA</div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: STYLES.c_red, letterSpacing: '-1px' }}>{data.avgHR} <span style={{fontSize:'14px', fontWeight:'500', color:STYLES.textDim}}>bpm</span></div>
              </div>
              <div style={{ backgroundColor: STYLES.card, border: `1px solid ${STYLES.border}`, padding: '24px', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                <div style={{ fontSize: '11px', color: STYLES.textDim, fontWeight: '700', letterSpacing: '0.5px', marginBottom: '8px' }}>DESACOPLE AERÓBICO</div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: data.decoupling > 5 ? STYLES.c_red : STYLES.c_green, letterSpacing: '-1px' }}>{data.decoupling}%</div>
              </div>
            </div>

            {!gpxData && !data.availability.hasAltitude && (
                <div style={{ border: `1px dashed ${STYLES.border}`, borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', position: 'relative', cursor: 'pointer', backgroundColor: '#fafafa' }}>
                    <input type="file" accept=".gpx" onChange={handleGpxUpload} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                    <PlusCircle size={18} color={STYLES.textDim} />
                    <span style={{ fontSize: '13px', color: STYLES.textDim, fontWeight: '500' }}>Cargar GPX para Altitud</span>
                </div>
            )}

            {gpxData ? (
                 <ChartSection title="Perfil de Elevación (GPX)" icon={Mountain} dataset={gpxData} dataKey="alt" color={STYLES.c_grey} unit="m" type="area" />
            ) : (data.availability.hasAltitude ? (
                 <ChartSection title="Perfil de Elevación" icon={Mountain} dataset={data.chartData} dataKey="alt" color={STYLES.c_grey} unit="m" type="area" />
            ) : null)}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
                <ChartSection title="Ritmo" icon={Gauge} dataset={data.chartData} dataKey="pace" color={STYLES.c_blue} unit="min/km" domain={[4, 10]} yReversed={true} />
                <ChartSection title="Frecuencia Cardíaca" icon={Heart} dataset={data.chartData} dataKey="hr" color={STYLES.c_red} unit="ppm" domain={['dataMin - 5', 'auto']} />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
                <ChartSection title="Simetría (GCT Balance Izq)" icon={Footprints} dataset={data.chartData} dataKey="gct" color={STYLES.c_green} unit="%" domain={[45, 55]} />
                {data.availability.hasGCT_ms && (
                  <ChartSection title="Tiempo Contacto (ms)" icon={Timer} dataset={data.chartData} dataKey="gct_ms" color={STYLES.c_cyan} unit="ms" domain={['dataMin - 10', 'dataMax + 10']} />
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
                <ChartSection title="Cadencia" icon={Activity} dataset={data.chartData} dataKey="cadence" color={STYLES.c_grey} unit="spm" domain={[140, 200]} />
                <ChartSection title="Longitud de Zancada" icon={Ruler} dataset={data.chartData} dataKey="stride" color={STYLES.c_orange} unit="m" domain={[0.5, 1.5]} />
            </div>
            
            {data.availability.hasVertOsc && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
                 <ChartSection title="Oscilación Vertical" icon={ArrowRight} dataset={data.chartData} dataKey="vertOsc" color={STYLES.c_purple} unit="mm" />
                 <ChartSection title="Ratio Vertical (%)" icon={Percent} dataset={data.chartData} dataKey="vRatio" color={STYLES.c_purple} unit="%" domain={[0, 15]} />
              </div>
            )}
             
            {data.availability.hasPower && (
              <ChartSection title="Potencia" icon={Zap} dataset={data.chartData} dataKey="pwr" color={STYLES.c_amber} unit="w" />
            )}

            <div style={{ marginTop: '40px', textAlign: 'center' }}>
              <button onClick={downloadCSV} style={{ backgroundColor: STYLES.text, color: 'white', fontWeight: '600', padding: '12px 24px', borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <FileText size={16} /> EXPORTAR CSV PROCESADO
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}