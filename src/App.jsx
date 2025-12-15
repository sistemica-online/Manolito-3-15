import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ComposedChart, Bar, Line 
} from 'recharts';
import { 
  Scale, Heart, Zap, Activity, MessageSquare, 
  Trophy, Timer
} from 'lucide-react';

// --- CONFIGURACIÓN ---
// 👇👇👇 ¡PEGA TU ENLACE AQUÍ! 👇👇👇
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQT2VlO6DOSyVSKjDYMHALcg9UgHQyRSFZ-SJFJqh_1_VQ51Ul4_NEUagRLAi9xj5C8hHcC2NPQ0L1K/pub?output=tsv"; 

// OBJETIVOS
const TARGET_DATE = "2026-04-26"; 
const TARGET_WEIGHT = 72.0;       
const TARGET_EF = 1.62;           
const TARGET_TIME_MINUTES = 195;  

// --- UTILS ---
const daysUntil = (dateStr) => {
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const predictTime = (currentEF) => {
  if (!currentEF || currentEF < 1.0) return "---";
  const ratio = TARGET_EF / currentEF;
  const predictedMinutes = TARGET_TIME_MINUTES * Math.pow(ratio, 1.1); 
  const h = Math.floor(predictedMinutes / 60);
  const m = Math.floor(predictedMinutes % 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
};

// --- COMPONENTES VISUALES CON ESTILO FORZADO ---

const StatCard = ({ title, value, unit, icon: Icon, colorHex, subtext, progress }) => {
  return (
    <div style={{ 
      backgroundColor: '#151621', 
      border: '1px solid #1e293b', 
      borderRadius: '12px', 
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Icono de fondo */}
      <div style={{ position: 'absolute', top: 0, right: 0, padding: '8px', opacity: 0.1, color: colorHex }}>
          <Icon size={40} />
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Icon size={16} color="#94a3b8" />
        <h3 style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b' }}>{title}</h3>
      </div>
      
      <div style={{ position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ fontSize: '30px', fontWeight: 'bold', color: 'white', fontFamily: 'monospace' }}>
            {value}
          </span>
          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>{unit}</span>
        </div>
        
        {progress !== undefined && (
          <div style={{ width: '100%', height: '6px', backgroundColor: '#0b0c15', borderRadius: '99px', marginTop: '12px', overflow: 'hidden', border: '1px solid #1e293b' }}>
            <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, progress))}%`, backgroundColor: colorHex, transition: 'width 1s' }} />
          </div>
        )}
        
        {subtext && <p style={{ fontSize: '10px', marginTop: '8px', fontFamily: 'monospace', opacity: 0.8, color: colorHex }}>{subtext}</p>}
      </div>
    </div>
  );
};

const MisterMessage = ({ message }) => {
  if (!message) return null;
  const msgLower = message.toLowerCase();
  
  let color = "#cbd5e1"; // default grey
  let borderColor = "#64748b";

  if (msgLower.match(/bien|cojonudo|sigue|perfecto|vamos/)) {
    color = "#00ff9d"; borderColor = "#00ff9d";
  } else if (msgLower.match(/cuidado|ojo|aviso|atento|vigila/)) {
    color = "#ffb700"; borderColor = "#ffb700";
  } else if (msgLower.match(/mal|parar|freno|dolor|lesion|stop/)) {
    color = "#ff0055"; borderColor = "#ff0055";
  }

  return (
    <div style={{ 
      marginTop: '32px', 
      backgroundColor: '#151621', 
      borderLeft: `4px solid ${borderColor}`, 
      borderRadius: '0 12px 12px 0', 
      padding: '24px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <MessageSquare size={16} color={color} />
        <h3 style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#64748b' }}>Feedback Técnico</h3>
      </div>
      <p style={{ fontSize: '20px', fontFamily: 'monospace', fontWeight: 'bold', fontStyle: 'italic', color: color }}>
        "{message}"
      </p>
    </div>
  );
};

// --- LOGICA PRINCIPAL ---
export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const parseNumber = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const cleanStr = String(val).replace(',', '.').trim(); 
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
  };

  useEffect(() => {
    if (SHEET_URL.includes("PEGA_AQUI")) {
        console.warn("URL no configurada");
        setLoading(false); return;
    }

    Papa.parse(SHEET_URL, {
      download: true, header: true, delimiter: '\t', skipEmptyLines: true,
      complete: (results) => {
        try {
          const cleanData = results.data.map((row, index) => ({
            id: index,
            Fecha: row.Fecha || "N/A",
            Peso: parseNumber(row.Peso),
            FC_Reposo: parseNumber(row.FC_Reposo),
            Tipo_Sesion: row.Tipo_Sesion || "Descanso",
            Distancia: parseNumber(row.Distancia),
            FC_Media: parseNumber(row.FC_Media),
            Eficiencia_EF: parseNumber(row.Eficiencia_EF),
            GCT_Balance_Izq: parseNumber(row.GCT_Balance_Izq) || 50.0,
            Mensaje_Mister: row.Mensaje_Mister || ""
          }));
          setData(cleanData); setLoading(false);
        } catch (err) { setError("Error datos: " + err.message); setLoading(false); }
      },
      error: (err) => { setError("Error conexión: " + err.message); setLoading(false); }
    });
  }, []);

  if (loading) return <div style={{ height: '100vh', backgroundColor: '#0b0c15', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00f2ff', fontFamily: 'monospace' }}>SINCRONIZANDO TELEMETRÍA...</div>;
  if (error) return <div style={{ height: '100vh', backgroundColor: '#0b0c15', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff0055', fontFamily: 'monospace' }}>{error}</div>;

  const last = data[data.length - 1] || {};
  
  // Lógica Semáforo
  const isRhrGood = last.FC_Reposo < 45;
  const isSoleusGood = last.GCT_Balance_Izq >= 49.0;
  
  const daysLeft = daysUntil(TARGET_DATE);
  const predictedTime = predictTime(last.Eficiencia_EF);
  
  const startWeight = 78.0; 
  const weightProgress = ((startWeight - last.Peso) / (startWeight - TARGET_WEIGHT)) * 100;
  const efProgress = ((last.Eficiencia_EF - 1.30) / (TARGET_EF - 1.30)) * 100;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: 'rgba(21, 22, 33, 0.95)', border: '1px solid #334155', padding: '12px', borderRadius: '4px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}>
          <p style={{ color: '#94a3b8', marginBottom: '8px', fontSize: '12px', fontFamily: 'monospace' }}>{label}</p>
          {payload.map((entry, index) => (
            <div key={index} style={{ color: entry.color, fontSize: '12px', marginBottom: '4px' }}>
              {entry.name}: <span style={{ color: 'white', fontWeight: 'bold' }}>{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    // ESTILOS EN LÍNEA: ESTO FUERZA EL FONDO NEGRO SÍ O SÍ
    <div style={{ minHeight: '100vh', backgroundColor: '#0b0c15', color: '#e2e8f0', fontFamily: 'sans-serif', paddingBottom: '80px' }}>
      
      {/* HEADER */}
      <div style={{ borderBottom: '1px solid #1e293b', backgroundColor: 'rgba(11, 12, 21, 0.8)', position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(4px)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '36px', fontWeight: '900', fontStyle: 'italic', lineHeight: 1, color: 'white', margin: 0 }}>
              MANOLITO <span style={{ color: '#00f2ff' }}>3:15</span>
            </h1>
            <p style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', letterSpacing: '0.1em', marginTop: '4px' }}>SISTEMA MAPOMA '26</p>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
             <div style={{ backgroundColor: '#151621', border: '1px solid #1e293b', borderRadius: '4px', padding: '8px 16px', textAlign: 'center', minWidth: '100px' }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>RACE DAY</div>
                <div style={{ fontSize: '24px', fontFamily: 'monospace', fontWeight: 'bold', color: 'white' }}>{daysLeft}</div>
             </div>
             <div style={{ backgroundColor: '#151621', border: '1px solid #1e293b', borderRadius: '4px', padding: '8px 16px', textAlign: 'center', minWidth: '120px' }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>PREDICCIÓN</div>
                <div style={{ fontSize: '24px', fontFamily: 'monospace', fontWeight: 'bold', color: 'white' }}>{predictedTime}</div>
             </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* KPI DASHBOARD */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          <StatCard title="Peso Actual" value={last.Peso} unit="kg" icon={Scale} colorHex="#00f2ff" subtext={`Meta: ${TARGET_WEIGHT}kg`} progress={weightProgress} />
          <StatCard title="FC Reposo" value={last.FC_Reposo} unit="ppm" icon={Heart} colorHex={isRhrGood ? "#00ff9d" : "#ffb700"} subtext={isRhrGood ? "Bradicardia OK" : "Vigilar fatiga"} />
          <StatCard title="Eficiencia (EF)" value={last.Eficiencia_EF} unit="pts" icon={Zap} colorHex="#d946ef" subtext={`Meta: ${TARGET_EF} pts`} progress={efProgress} />
          <StatCard title="Sóleo (GCT)" value={last.GCT_Balance_Izq} unit="%" icon={Activity} colorHex={isSoleusGood ? "#00ff9d" : "#ff0055"} subtext={isSoleusGood ? "Simetría OK" : "Descompensado"} />
        </div>

        <MisterMessage message={last.Mensaje_Mister} />

        {/* CHARTS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
          
          {/* GRÁFICA 1 */}
          <div style={{ backgroundColor: '#151621', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={14} color="#00f2ff"/> Eficiencia
            </h3>
            <div style={{ height: '256px', width: '100%' }}>
              <ResponsiveContainer>
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorEf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00f2ff" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#00f2ff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} vertical={false} />
                  <XAxis dataKey="Fecha" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickMargin={10}/>
                  <YAxis domain={['auto', 'auto']} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Eficiencia_EF" stroke="#00f2ff" strokeWidth={2} fillOpacity={1} fill="url(#colorEf)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GRÁFICA 2 */}
          <div style={{ backgroundColor: '#151621', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trophy size={14} color="#00ff9d"/> Carga vs Pulso
            </h3>
            <div style={{ height: '256px', width: '100%' }}>
              <ResponsiveContainer>
                <ComposedChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} vertical={false} />
                  <XAxis dataKey="Fecha" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickMargin={10}/>
                  <YAxis yAxisId="left" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false}/>
                  <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false}/>
                  <Tooltip content={<CustomTooltip />} />
                  <Bar yAxisId="left" dataKey="Distancia" fill="#334155" radius={[2, 2, 0, 0]} barSize={12} />
                  <Line yAxisId="right" type="monotone" dataKey="FC_Media" stroke="#ff0055" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}