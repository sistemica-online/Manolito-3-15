import React, { useEffect, useState, useMemo } from 'react';
import Papa from 'papaparse';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ComposedChart, Bar, Legend, ReferenceLine 
} from 'recharts';
import { 
  Activity, Heart, Zap, Scale, AlertTriangle, 
  TrendingUp, MessageSquare, Timer 
} from 'lucide-react';

// --- CONSTANTES ---
// ¡REEMPLAZA ESTO CON TU URL DE GOOGLE SHEETS (FORMATO CSV)!
const GOOGLE_SHEET_URL = "TU_URL_DE_GOOGLE_SHEETS_AQUI"; 

const DEMO_DATA = [
  { Fecha: "01/10", Peso: 78.5, FC_Reposo: 52, Tipo_Sesion: "Rodaje", Distancia: 10, Ritmo_Medio: "5:15", FC_Media: 145, Watios_Medios: 260, Eficiencia_EF: 1.35, GCT_Balance_Izq: 49.5, Sensaciones: 7, Mensaje_Mister: "Buen inicio, controlando." },
  { Fecha: "03/10", Peso: 78.2, FC_Reposo: 50, Tipo_Sesion: "Series", Distancia: 12, Ritmo_Medio: "4:45", FC_Media: 158, Watios_Medios: 290, Eficiencia_EF: 1.38, GCT_Balance_Izq: 49.2, Sensaciones: 6, Mensaje_Mister: "Ojo al ritmo, no te pases." },
  { Fecha: "05/10", Peso: 78.0, FC_Reposo: 48, Tipo_Sesion: "Largo", Distancia: 22, Ritmo_Medio: "5:30", FC_Media: 142, Watios_Medios: 255, Eficiencia_EF: 1.41, GCT_Balance_Izq: 48.5, Sensaciones: 5, Mensaje_Mister: "Cuidado con ese sóleo izquierdo." },
  { Fecha: "08/10", Peso: 77.8, FC_Reposo: 46, Tipo_Sesion: "Rodaje", Distancia: 10, Ritmo_Medio: "5:10", FC_Media: 138, Watios_Medios: 265, Eficiencia_EF: 1.45, GCT_Balance_Izq: 49.0, Sensaciones: 8, Mensaje_Mister: "Sigue así, buena asimilación." },
  { Fecha: "12/10", Peso: 77.5, FC_Reposo: 44, Tipo_Sesion: "Calidad", Distancia: 14, Ritmo_Medio: "4:30", FC_Media: 160, Watios_Medios: 310, Eficiencia_EF: 1.48, GCT_Balance_Izq: 50.1, Sensaciones: 9, Mensaje_Mister: "Cojonudo, estamos en camino." },
];

// --- COMPONENTES UI ---

const Card = ({ title, value, unit, icon: Icon, trendColor, subtext, borderColor = "border-slate-700" }) => (
  <div className={`bg-f1-card p-4 rounded-lg border-l-4 ${borderColor} shadow-lg relative overflow-hidden`}>
    <div className="flex justify-between items-start mb-2">
      <h3 className="text-slate-400 text-xs uppercase tracking-wider font-bold">{title}</h3>
      <Icon size={18} className="text-slate-500" />
    </div>
    <div className="flex items-baseline gap-1">
      <span className={`text-2xl font-mono font-bold ${trendColor || 'text-slate-200'}`}>{value}</span>
      <span className="text-xs text-slate-500">{unit}</span>
    </div>
    {subtext && <p className="text-xs text-slate-400 mt-2">{subtext}</p>}
  </div>
);

const MisterFeedback = ({ message }) => {
  if (!message) return null;
  
  let styles = "border-slate-500 bg-slate-800/50 text-slate-300"; // Neutral
  const msgLower = message.toLowerCase();

  // Lógica Semáforo
  if (msgLower.match(/bien|cojonudo|sigue|perfecto|vamos/)) {
    styles = "border-emerald-500 bg-emerald-900/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]";
  } else if (msgLower.match(/cuidado|ojo|aviso|atento|vigila/)) {
    styles = "border-amber-500 bg-amber-900/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]";
  } else if (msgLower.match(/mal|parar|freno|dolor|lesion|stop/)) {
    styles = "border-rose-500 bg-rose-900/20 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)]";
  }

  return (
    <div className={`mt-6 p-4 border rounded-lg ${styles} transition-all duration-300`}>
      <div className="flex items-center gap-3 mb-1">
        <MessageSquare size={18} />
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-80">Mensaje del Míster</h3>
      </div>
      <p className="text-lg font-medium italic">"{message}"</p>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (GOOGLE_SHEET_URL === "TU_URL_DE_GOOGLE_SHEETS_AQUI") {
          // Usar datos demo si no hay URL configurada
          console.warn("Usando datos de demostración.");
          processData(DEMO_DATA);
          setLoading(false);
          return;
        }

        Papa.parse(GOOGLE_SHEET_URL, {
          download: true,
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            processData(results.data);
            setLoading(false);
          },
          error: (err) => {
            setError("Error leyendo el CSV: " + err.message);
            setLoading(false);
          }
        });
      } catch (e) {
        setError("Error de red");
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const processData = (rawData) => {
    // Convertir strings a números y limpiar datos
    const processed = rawData.map(row => ({
      ...row,
      Peso: parseFloat(row.Peso) || 0,
      FC_Reposo: parseInt(row.FC_Reposo) || 0,
      Distancia: parseFloat(row.Distancia) || 0,
      FC_Media: parseInt(row.FC_Media) || 0,
      Watios_Medios: parseInt(row.Watios_Medios) || 0,
      Eficiencia_EF: parseFloat(row.Eficiencia_EF) || 0,
      GCT_Balance_Izq: parseFloat(row.GCT_Balance_Izq) || 50, // Default 50 si falta
    }));
    // Asumimos que los datos vienen en orden cronológico, si no, habría que ordenar por fecha.
    // processed.sort((a,b) => ...logica fecha...);
    setData(processed);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-f1-bg text-f1-tech animate-pulse">Cargando Telemetría...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center bg-f1-bg text-f1-alert">{error}</div>;

  // Obtener último registro
  const lastSession = data[data.length - 1] || {};
  
  // Lógica KPI
  const isRhrGood = lastSession.FC_Reposo < 45;
  const isSoleusGood = lastSession.GCT_Balance_Izq >= 49.0;

  // Custom Tooltip para Gráficos
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded shadow-xl text-xs">
          <p className="font-bold text-slate-300 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: <span className="font-mono">{entry.value}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-f1-bg text-slate-200 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <Activity className="text-f1-tech" />
              MANOLITO <span className="text-f1-tech">3:15</span> CS
            </h1>
            <p className="text-slate-500 text-sm mt-1">SISTEMA DE CONTROL DE RENDIMIENTO Y FISIOLOGÍA</p>
          </div>
          <div className="flex items-center gap-3 bg-slate-800 px-4 py-2 rounded-full">
            <div className={`w-3 h-3 rounded-full ${isRhrGood ? 'bg-f1-accent animate-pulse' : 'bg-f1-warn'}`}></div>
            <span className="text-xs font-mono text-slate-300">ESTADO DEL SISTEMA: {isRhrGood ? 'ÓPTIMO' : 'VIGILAR'}</span>
          </div>
        </header>

        {/* KPI GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card 
            title="Peso Actual" 
            value={lastSession.Peso} 
            unit="kg" 
            icon={Scale}
            borderColor="border-slate-600"
          />
          <Card 
            title="FC Reposo" 
            value={lastSession.FC_Reposo} 
            unit="ppm" 
            icon={Heart}
            trendColor={isRhrGood ? "text-f1-accent" : "text-slate-200"}
            borderColor={isRhrGood ? "border-f1-accent" : "border-slate-600"}
            subtext={isRhrGood ? "Bradicardia atlética OK" : "Recuperación pendiente"}
          />
          <Card 
            title="Eficiencia (EF)" 
            value={lastSession.Eficiencia_EF} 
            unit="pts" 
            icon={Zap}
            trendColor="text-f1-tech"
            borderColor="border-f1-tech"
            subtext="Ratio Watios/FC"
          />
          <Card 
            title="Salud Sóleo (GCT L)" 
            value={lastSession.GCT_Balance_Izq} 
            unit="%" 
            icon={TrendingUp}
            trendColor={isSoleusGood ? "text-f1-accent" : "text-f1-alert"}
            borderColor={isSoleusGood ? "border-f1-accent" : "border-f1-alert"}
            subtext={isSoleusGood ? "Simetría correcta" : "Descompensación detectada"}
          />
        </div>

        {/* FEEDBACK DEL MISTER */}
        <MisterFeedback message={lastSession.Mensaje_Mister} />

        {/* GRÁFICOS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          
          {/* GRÁFICO 1: EVOLUCIÓN EFICIENCIA */}
          <div className="bg-f1-card p-6 rounded-xl border border-slate-800 shadow-lg">
            <h3 className="text-slate-400 text-sm font-bold uppercase mb-6 flex items-center gap-2">
              <Zap size={16} className="text-f1-tech"/> La Curva de Eficiencia
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="Fecha" stroke="#64748b" fontSize={12} tickLine={false} />
                  <YAxis domain={['dataMin - 0.1', 'dataMax + 0.1']} stroke="#64748b" fontSize={12} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="Eficiencia_EF" 
                    stroke="#06b6d4" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#06b6d4', strokeWidth: 0 }} 
                    activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                    name="Eficiencia"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* GRÁFICO 2: CARGA VS RESPUESTA */}
          <div className="bg-f1-card p-6 rounded-xl border border-slate-800 shadow-lg">
            <h3 className="text-slate-400 text-sm font-bold uppercase mb-6 flex items-center gap-2">
              <Timer size={16} className="text-f1-accent"/> Carga (Vol) vs Corazón (Int)
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="Fecha" stroke="#64748b" fontSize={12} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#64748b" fontSize={12} tickLine={false} label={{ value: 'km', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" domain={['dataMin - 10', 'auto']} stroke="#64748b" fontSize={12} tickLine={false} label={{ value: 'bpm', angle: 90, position: 'insideRight', fill: '#64748b', fontSize: 10 }}/>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar yAxisId="left" dataKey="Distancia" name="Distancia (km)" fill="#334155" radius={[4, 4, 0, 0]} barSize={20} />
                  <Line yAxisId="right" type="monotone" dataKey="FC_Media" name="FC Media" stroke="#f43f5e" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* LOG TABLE */}
        <div className="bg-f1-card rounded-xl border border-slate-800 shadow-lg overflow-hidden">
          <div className="p-4 border-b border-slate-800 bg-slate-900/50">
            <h3 className="text-slate-400 text-sm font-bold uppercase flex items-center gap-2">
              <AlertTriangle size={16} className="text-slate-500"/> Registro de Sesiones (Últimas 10)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-400">
              <thead className="text-xs uppercase bg-slate-900 text-slate-500">
                <tr>
                  <th className="px-6 py-3">Fecha</th>
                  <th className="px-6 py-3">Sesión</th>
                  <th className="px-6 py-3 text-right">Dist (km)</th>
                  <th className="px-6 py-3 text-right">Ritmo</th>
                  <th className="px-6 py-3 text-right">FC Avg</th>
                  <th className="px-6 py-3 text-right">Watts</th>
                </tr>
              </thead>
              <tbody>
                {[...data].reverse().slice(0, 10).map((row, index) => (
                  <tr key={index} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-3 font-mono text-slate-300">{row.Fecha}</td>
                    <td className="px-6 py-3">
                      <span className="px-2 py-1 rounded text-xs bg-slate-800 border border-slate-700 text-slate-300">
                        {row.Tipo_Sesion}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-f1-tech">{row.Distancia}</td>
                    <td className="px-6 py-3 text-right font-mono">{row.Ritmo_Medio}</td>
                    <td className="px-6 py-3 text-right font-mono text-rose-400">{row.FC_Media}</td>
                    <td className="px-6 py-3 text-right font-mono text-emerald-400">{row.Watios_Medios}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}