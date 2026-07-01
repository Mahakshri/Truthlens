import { useState, useEffect } from "react";
import { ArrowRight, Terminal, Shield, RefreshCw, Cpu, CheckCircle, HelpCircle } from "lucide-react";
import CustomCursor from "./components/CustomCursor";
import BackgroundGraphics from "./components/BackgroundGraphics";
import InteractivePhysicsLogo from "./components/InteractivePhysicsLogo";
import ThreeQuestionCards from "./components/ThreeQuestionCards";
import AIPipelineGraph from "./components/AIPipelineGraph";
import TelemetryPlayground from "./components/TelemetryPlayground";

export default function App() {
  const [btnHovered, setBtnHovered] = useState(false);
  const [timeStr, setTimeStr] = useState("");

  // Update live clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeString = now.toTimeString().split(" ")[0];
      setTimeStr(timeString);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const scrollToScanner = () => {
    const scannerSection = document.getElementById("telemetry-lab");
    if (scannerSection) {
      scannerSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="relative min-h-screen bg-[#050505] text-[#F4F4F0] selection:bg-sand/30 selection:text-[#F4F4F0] overflow-hidden font-sans">
      
      {/* Immersive Custom Magnifying Glass Background Effect & Grid */}
      <BackgroundGraphics />

      {/* Immersive Custom Cursor */}
      <CustomCursor />

      {/* Top Header Navbar */}
      <header className="sticky top-0 z-50 w-full bg-[#050505]/80 backdrop-blur-md border-b border-white/5 px-4 md:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs font-mono">
          
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-[0.3em] text-[#F4F4F0] hover:text-sand transition-colors duration-300">
              [ TRUTHLENS ]
            </span>
            <span className="hidden sm:inline-block text-[9px] font-mono text-sand/60 border border-sand/20 px-1.5 py-0.5 rounded uppercase">
              SYS.SECURE_V2
            </span>
          </div>

          {/* Core Navigation links */}
          <nav className="hidden md:flex items-center gap-8 text-[11px] tracking-widest text-slate-muted">
            <a href="#home" className="hover:text-alabaster transition-colors duration-300 uppercase">
              Home
            </a>
            <a href="#deep-assessment" className="hover:text-alabaster transition-colors duration-300 uppercase">
              Assessment
            </a>
            <a href="#pipeline" className="hover:text-alabaster transition-colors duration-300 uppercase">
              Pipeline
            </a>
            <a href="#telemetry-lab" className="hover:text-alabaster transition-colors duration-300 uppercase">
              Forensic_Lab
            </a>
          </nav>

          {/* Telemetry status bar and precise live time tracker */}
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-muted">
              <span>Local time:</span>
              <span className="text-sand font-semibold">{timeStr || "00:00:00"}</span>
            </div>
            
            <button
              onClick={scrollToScanner}
              className="text-[10px] border border-sand/40 hover:border-sand px-4 py-1.5 rounded bg-sand/5 text-sand hover:bg-sand/10 transition-all duration-300 uppercase tracking-widest interactive"
            >
              [ INITIALIZE_SCANNER ]
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="home" className="relative w-full min-h-[90vh] flex flex-col justify-between pt-12 pb-24 px-4 md:px-8 border-b border-white/5">
        
        {/* Subtle side markers */}
        <div className="absolute left-6 top-1/3 hidden xl:flex flex-col gap-4 text-[9px] font-mono text-white/10 tracking-widest select-none">
          <span>SECURE_CHANNELS: ACTIVE</span>
          <span>DATA_INTEGRITY: 100%</span>
        </div>

        <div className="absolute right-6 top-1/3 hidden xl:flex flex-col gap-4 text-[9px] font-mono text-white/10 tracking-widest text-right select-none">
          <span>LATENCY: 8MS</span>
          <span>LOCATION: SECURE_CLOUD</span>
        </div>

        {/* Hero Central interactive container */}
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-center items-center relative z-10 text-center">
          <span className="text-[10px] font-mono tracking-[0.3em] text-sand uppercase mb-6 block">
            [ NEXT-GEN COGNITIVE FORENSICS ]
          </span>
          
          <h1 className="text-5xl md:text-7xl font-extralight tracking-tight text-[#F4F4F0] mb-8 leading-tight">
            Deciphering Truth in <br />
            <span className="font-semibold text-sand">Synthetic Media</span>
          </h1>

          <p className="text-sm md:text-base font-light text-slate-muted max-w-2xl leading-relaxed mb-12">
            An advanced neural verification platform engineered to analyze visual authenticity, trace cryptographic lineage logs, and detect deepfakes in high-priority digital content.
          </p>

          {/* Interactive Helmet 3D Model in the center */}
          <div className="w-full max-w-md aspect-square flex items-center justify-center mb-8">
            <InteractivePhysicsLogo />
          </div>
        </div>

        {/* Hero Bottom: Text statement & CTA */}
        <div className="max-w-7xl mx-auto w-full mt-12 flex flex-col md:flex-row items-end justify-between gap-8 z-10">
          <div className="text-left max-w-md">
            <span className="text-[10px] font-mono tracking-[0.3em] text-sand uppercase mb-2 block">
              [ CRYPTOGRAPHIC SECURE ]
            </span>
            <p className="text-xs sm:text-sm font-light text-slate-muted leading-relaxed font-sans">
              Truthlens utilizes deep micro-sensor forensics, spatial visual transformers, and metadata ledgers to reconstruct absolute lineage maps for digital content, securing authentication globally.
            </p>
          </div>

          <button
            onMouseEnter={() => setBtnHovered(true)}
            onMouseLeave={() => setBtnHovered(false)}
            onClick={scrollToScanner}
            className="text-xs font-mono border border-sand/40 hover:border-sand px-6 py-3 rounded bg-sand/5 text-sand hover:bg-sand/10 transition-all duration-300 uppercase tracking-[0.2em] flex items-center gap-2 interactive"
          >
            <span>[ INITIALIZE CORE SCANNER ]</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </section>

      {/* Deep Assessment Sections */}
      <section id="deep-assessment" className="relative w-full">
        <ThreeQuestionCards />
      </section>

      {/* AI Pipeline Graph Section */}
      <section id="pipeline" className="relative w-full">
        <AIPipelineGraph />
      </section>

      {/* Simulated Telemetry Playground Section */}
      <section id="telemetry-lab" className="relative w-full bg-gradient-to-b from-[#050505] to-[#0A0A0A]">
        <TelemetryPlayground />
      </section>

      {/* Immersive Footer wrapping curved calibration gauges */}
      <footer className="w-full border-t border-white/5 bg-[#050505] py-24 px-4 md:px-8 text-center relative z-20 overflow-hidden">
        
        {/* Large concentric design ring background */}
        <div className="absolute bottom-[-150px] left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full border border-white/[0.02] pointer-events-none flex items-center justify-center">
          <div className="w-[500px] h-[500px] rounded-full border border-sand/[0.02]" />
          <div className="w-[300px] h-[300px] rounded-full border border-white/[0.01]" />
        </div>

        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center relative z-10">
          
          <div className="mb-12 text-center group">
            <span className="text-[10px] font-mono tracking-[0.4em] text-sand uppercase block mb-3">
              [ INITIATE CONNECTION ]
            </span>
            <a 
              href="mailto:hello@truthlens.studio" 
              className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-white hover:text-sand transition-colors duration-500 font-mono select-all uppercase interactive"
            >
              hello@truthlens.studio
            </a>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between w-full mt-16 pt-12 border-t border-white/5 text-[11px] font-mono text-slate-muted">
            <div className="text-left">
              <span className="text-xs font-bold tracking-[0.3em] text-alabaster uppercase block mb-2">
                [ TRUTHLENS FORENSICS ]
              </span>
              <p className="max-w-sm leading-relaxed text-slate-muted">
                Securing digital authenticity ledgers worldwide. Built for multi-modal spatial, temporal, and cryptographic sensor calibration.
              </p>
            </div>

            <div className="mt-8 md:mt-0 flex flex-wrap gap-8">
              <div className="text-left">
                <span className="text-sand block mb-1">C2PA LEDGER v2.4</span>
                <span>SECURE HARDWARE ANCHORS</span>
              </div>
              <div className="text-left">
                <span className="text-sand block mb-1">BAYESIAN FUSION</span>
                <span>NEURAL VISUAL TRANSFORMERS</span>
              </div>
            </div>
          </div>

          <div className="w-full mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-[10px] font-mono text-slate-muted">
            <div>
              &copy; 2026 TRUTHLENS LABS INC. ALL TRADEMARKS REGISTERED.
            </div>
            <div className="mt-4 sm:mt-0 uppercase tracking-widest text-sand/80">
              [ VERIFIED SECURE NODE RUNNING AT PORT 3000 ]
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
