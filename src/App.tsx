/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'motion/react';
import { 
  Cpu, 
  Zap, 
  Activity, 
  Layers, 
  Play, 
  RefreshCw, 
  TrendingUp, 
  Server,
  MousePointer2
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Data ---
const BENCHMARK_DATA = {
  single: { time: 142.5, throughput: 12.4, color: '#22d3ee' },
  multi2x: { time: 78.2, throughput: 22.8, color: '#a855f7' },
  multi4x: { time: 42.1, throughput: 44.5, color: '#d946ef' },
};

const CHART_DATA = [
  { name: '0%', single: 0, multi2x: 0, multi4x: 0 },
  { name: '20%', single: 28.5, multi2x: 15.6, multi4x: 8.4 },
  { name: '40%', single: 57.0, multi2x: 31.2, multi4x: 16.8 },
  { name: '60%', single: 85.5, multi2x: 46.8, multi4x: 25.2 },
  { name: '80%', single: 114.0, multi2x: 62.4, multi4x: 33.6 },
  { name: '100%', single: 142.5, multi2x: 78.2, multi4x: 42.1 },
];

const THROUGHPUT_DATA = [
  { nodes: '1x GPU', val: 12.4 },
  { nodes: '2x GPU', val: 22.8 },
  { nodes: '4x GPU', val: 44.5 },
];

// --- Components ---

const CustomCursor = () => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [isHovering, setIsHovering] = useState(false);

  const springConfig = { damping: 25, stiffness: 250 };
  const cursorX = useSpring(mouseX, springConfig);
  const cursorY = useSpring(mouseY, springConfig);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, a, .interactive-card')) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseover', handleMouseOver);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, [mouseX, mouseY]);

  return (
    <motion.div
      className="fixed top-0 left-0 w-8 h-8 pointer-events-none z-50 mix-blend-difference"
      style={{ x: cursorX, y: cursorY, translateX: '-50%', translateY: '-50%' }}
    >
      <motion.div
        animate={{
          scale: isHovering ? 2.5 : 1,
          opacity: isHovering ? 0.8 : 1,
        }}
        className="w-full h-full flex items-center justify-center"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="8" stroke="white" strokeWidth="1" />
          <circle cx="12" cy="12" r="2" fill="white" />
        </svg>
      </motion.div>
    </motion.div>
  );
};

const GridBackground = () => (
  <div className="fixed inset-0 z-0 pointer-events-none opacity-20">
    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_50%_-100px,#22d3ee15,transparent)]" />
  </div>
);

const LiveMonitor = ({ title, value, unit, icon: Icon, color }: { title: string, value: string, unit: string, icon: any, color: string }) => {
  const [displayValue, setDisplayValue] = useState(parseFloat(value));
  
  useEffect(() => {
    const interval = setInterval(() => {
      const noise = (Math.random() - 0.5) * 0.5;
      setDisplayValue(prev => Math.max(0, prev + noise));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="interactive-card bg-card border-glass p-6 rounded-2xl relative overflow-hidden group">
      <div className={cn("absolute top-0 left-0 w-1 h-full", color)} />
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 rounded-lg bg-white/5">
          <Icon className="w-5 h-5 text-white/60" />
        </div>
        <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Live Feed</div>
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-white/60">{title}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold font-mono tracking-tighter">
            {displayValue.toFixed(1)}
          </span>
          <span className="text-xs font-mono text-white/40">{unit}</span>
        </div>
      </div>
      <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className={cn("h-full w-1/3 opacity-50", color)}
        />
      </div>
    </div>
  );
};

const BenchmarkRunner = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ single: 0, multi2x: 0, multi4x: 0 });

  const runBenchmark = () => {
    if (isRunning) return;
    setIsRunning(true);
    setProgress({ single: 0, multi2x: 0, multi4x: 0 });

    const duration = 3000; // 3 seconds simulation
    const start = Date.now();

    const frame = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / duration);
      
      // Multi-GPU finishes faster in our simulation
      setProgress({
        single: t * 100,
        multi2x: Math.min(100, t * 1.8 * 100),
        multi4x: Math.min(100, t * 3.4 * 100),
      });

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        setIsRunning(false);
      }
    };

    requestAnimationFrame(frame);
  };

  return (
    <div className="interactive-card bg-card border-glass p-8 rounded-2xl col-span-full lg:col-span-2">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-xl font-bold mb-1">Performance Stress Test</h2>
          <p className="text-sm text-white/40">Simulating 10,000 batch inference operations</p>
        </div>
        <button 
          onClick={runBenchmark}
          disabled={isRunning}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-xl font-mono text-sm transition-all active:scale-95",
            isRunning 
              ? "bg-white/5 text-white/20 cursor-not-allowed" 
              : "bg-accent-cyan text-bg font-bold hover:glow-cyan"
          )}
        >
          {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
          {isRunning ? 'RUNNING...' : 'START BENCHMARK'}
        </button>
      </div>

      <div className="space-y-6">
        {[
          { label: 'Single GPU (Baseline)', val: progress.single, color: 'bg-accent-cyan' },
          { label: 'Multi-GPU (2x Nodes)', val: progress.multi2x, color: 'bg-accent-purple' },
          { label: 'Multi-GPU (4x Nodes)', val: progress.multi4x, color: 'bg-accent-magenta' },
        ].map((item, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-between text-xs font-mono uppercase tracking-wider text-white/60">
              <span>{item.label}</span>
              <span>{item.val.toFixed(1)}%</span>
            </div>
            <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${item.val}%` }}
                transition={{ ease: [0.22, 1, 0.36, 1] }}
                className={cn("h-full rounded-full", item.color)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <CustomCursor />
      <GridBackground />

      {/* Hero Section */}
      <header className="relative z-10 pt-24 pb-12 px-6 max-w-7xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan text-[10px] font-mono uppercase tracking-[0.2em] mb-6">
            <Zap className="w-3 h-3" /> System Performance Analysis
          </div>
          <h1 className="text-5xl md:text-7xl font-bold font-mono tracking-tighter mb-6 bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">
            COMPUTE VELOCITY
          </h1>
          <p className="text-white/40 max-w-2xl mx-auto text-lg font-light leading-relaxed">
            Comparing parallel processing efficiency across distributed GPU clusters. 
            Visualizing the non-linear scaling of modern compute architectures.
          </p>
        </motion.div>
      </header>

      {/* Main Dashboard */}
      <main className="relative z-10 px-6 pb-24 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Live Monitors */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            <LiveMonitor 
              title="VRAM Allocation" 
              value="24.2" 
              unit="GB" 
              icon={Layers} 
              color="bg-accent-cyan" 
            />
            <LiveMonitor 
              title="Core Clock Frequency" 
              value="2505" 
              unit="MHz" 
              icon={Activity} 
              color="bg-accent-purple" 
            />
            <div className="interactive-card bg-card border-glass p-6 rounded-2xl">
              <h3 className="text-sm font-medium text-white/60 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Efficiency Scaling
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-xs text-white/40">2x Scaling</span>
                  <span className="text-xl font-mono text-accent-purple">1.8x</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-xs text-white/40">4x Scaling</span>
                  <span className="text-xl font-mono text-accent-cyan">3.4x</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Processing Time Graph */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="interactive-card bg-card border-glass p-6 rounded-2xl lg:col-span-2 min-h-[400px]"
          >
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="font-bold">Total Processing Time</h3>
                <p className="text-xs text-white/40">Lower is better (Seconds)</p>
              </div>
              <div className="flex gap-4 text-[10px] font-mono uppercase">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-accent-cyan" /> Single
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-accent-purple" /> 2x Multi
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-accent-magenta" /> 4x Multi
                </div>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={CHART_DATA}>
                  <defs>
                    <linearGradient id="colorSingle" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorMulti2x" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorMulti4x" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d946ef" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#d946ef" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#ffffff20" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#ffffff20" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f0f0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="single" stroke="#22d3ee" fillOpacity={1} fill="url(#colorSingle)" strokeWidth={2} />
                  <Area type="monotone" dataKey="multi2x" stroke="#a855f7" fillOpacity={1} fill="url(#colorMulti2x)" strokeWidth={2} />
                  <Area type="monotone" dataKey="multi4x" stroke="#d946ef" fillOpacity={1} fill="url(#colorMulti4x)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Benchmark Runner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="col-span-full grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            <BenchmarkRunner />
            
            {/* Throughput Card */}
            <div className="interactive-card bg-card border-glass p-6 rounded-2xl flex flex-col">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-lg bg-white/5">
                  <Server className="w-5 h-5 text-white/60" />
                </div>
                <h3 className="font-bold">Throughput</h3>
              </div>
              <div className="flex-1 flex flex-col justify-center gap-8">
                {THROUGHPUT_DATA.map((item, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-12 text-[10px] font-mono text-white/40 uppercase">{item.nodes}</div>
                    <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(item.val / 44.5) * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: 0.8 + i * 0.1 }}
                        className={cn(
                          "h-full rounded-full",
                          i === 0 ? 'bg-accent-cyan' : i === 1 ? 'bg-accent-purple' : 'bg-accent-magenta'
                        )}
                      />
                    </div>
                    <div className="w-16 text-right font-mono text-sm">{item.val} <span className="text-[10px] text-white/40">T/s</span></div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-6 border-t border-white/5 text-[10px] text-white/40 font-mono uppercase tracking-widest text-center">
                Tokens per second (Inference)
              </div>
            </div>
          </motion.div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-12 border-t border-white/5 text-center">
        <div className="flex items-center justify-center gap-2 text-white/20 text-xs font-mono uppercase tracking-widest">
          <Cpu className="w-4 h-4" /> Powered by Neural Compute Engine v4.2
        </div>
      </footer>
    </div>
  );
}
