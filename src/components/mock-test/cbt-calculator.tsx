"use client";

import React, { useState } from "react";

interface CbtCalculatorProps {
  onClose: () => void;
}

export function CbtCalculator({ onClose }: CbtCalculatorProps) {
  const [display, setDisplay] = useState("0");
  const [memory, setMemory] = useState<number | null>(null);
  const [isScientific, setIsScientific] = useState(false);

  const handleDigit = (digit: string) => {
    if (display === "0" || display === "Error") {
      setDisplay(digit);
    } else {
      setDisplay(display + digit);
    }
  };

  const handleOperator = (op: string) => {
    if (display.endsWith(" ") || display === "Error") return;
    setDisplay(display + " " + op + " ");
  };

  const handleClear = () => {
    setDisplay("0");
  };

  const handleBackspace = () => {
    if (display.length <= 1 || display === "Error") {
      setDisplay("0");
    } else {
      setDisplay(display.slice(0, -1).trimEnd());
    }
  };

  const handleCalculate = () => {
    try {
      // Safe evaluation of simple math expressions
      const sanitized = display
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/π/g, "Math.PI")
        .replace(/e/g, "Math.E")
        .replace(/√\(([^)]+)\)/g, "Math.sqrt($1)");
      
      // Evaluate basic arithmetic string safely
      const fn = new Function(`return ${sanitized}`);
      const result = fn();
      if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
        setDisplay(String(Number(result.toFixed(8))));
      } else {
        setDisplay("Error");
      }
    } catch {
      setDisplay("Error");
    }
  };

  const handleFunc = (funcName: string) => {
    try {
      const val = parseFloat(display);
      if (isNaN(val)) return;
      let res = 0;
      if (funcName === "sqrt") res = Math.sqrt(val);
      else if (funcName === "sq") res = Math.pow(val, 2);
      else if (funcName === "sin") res = Math.sin((val * Math.PI) / 180);
      else if (funcName === "cos") res = Math.cos((val * Math.PI) / 180);
      else if (funcName === "tan") res = Math.tan((val * Math.PI) / 180);
      else if (funcName === "log") res = Math.log10(val);
      else if (funcName === "ln") res = Math.log(val);
      else if (funcName === "neg") res = -val;
      setDisplay(String(Number(res.toFixed(8))));
    } catch {
      setDisplay("Error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm rounded-lg bg-slate-900 text-white shadow-2xl border border-slate-700 overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center justify-between bg-slate-800 px-4 py-2 text-xs font-semibold tracking-wider text-slate-200">
          <span>ONLINE CBT CALCULATOR</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsScientific(!isScientific)}
              className="text-[10px] px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition"
            >
              {isScientific ? "Basic" : "Scientific"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Display Screen */}
        <div className="p-4 bg-slate-950 text-right">
          <div className="text-2xl font-mono tracking-wider text-emerald-400 min-h-[36px] overflow-x-auto whitespace-nowrap">
            {display}
          </div>
        </div>

        {/* Keypad */}
        <div className="p-3 bg-slate-900 grid grid-cols-4 gap-1.5 text-sm font-medium">
          <button
            type="button"
            onClick={handleClear}
            className="col-span-2 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded font-bold transition"
          >
            C / AC
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="py-2 bg-amber-600/80 hover:bg-amber-600 text-white rounded flex items-center justify-center transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414-6.414a2 2 0 011.414-.586H19a2 2 0 012 2v10a2 2 0 01-2 2H10.828a2 2 0 01-1.414-.586L3 12z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => handleOperator("÷")}
            className="py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-lg transition"
          >
            ÷
          </button>

          {isScientific && (
            <>
              <button
                type="button"
                onClick={() => handleFunc("sin")}
                className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
              >
                sin
              </button>
              <button
                type="button"
                onClick={() => handleFunc("cos")}
                className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
              >
                cos
              </button>
              <button
                type="button"
                onClick={() => handleFunc("tan")}
                className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
              >
                tan
              </button>
              <button
                type="button"
                onClick={() => handleFunc("sqrt")}
                className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
              >
                √
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => handleDigit("7")}
            className="py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold transition"
          >
            7
          </button>
          <button
            type="button"
            onClick={() => handleDigit("8")}
            className="py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold transition"
          >
            8
          </button>
          <button
            type="button"
            onClick={() => handleDigit("9")}
            className="py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold transition"
          >
            9
          </button>
          <button
            type="button"
            onClick={() => handleOperator("×")}
            className="py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-lg transition"
          >
            ×
          </button>

          <button
            type="button"
            onClick={() => handleDigit("4")}
            className="py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold transition"
          >
            4
          </button>
          <button
            type="button"
            onClick={() => handleDigit("5")}
            className="py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold transition"
          >
            5
          </button>
          <button
            type="button"
            onClick={() => handleDigit("6")}
            className="py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold transition"
          >
            6
          </button>
          <button
            type="button"
            onClick={() => handleOperator("-")}
            className="py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-lg transition"
          >
            -
          </button>

          <button
            type="button"
            onClick={() => handleDigit("1")}
            className="py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold transition"
          >
            1
          </button>
          <button
            type="button"
            onClick={() => handleDigit("2")}
            className="py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold transition"
          >
            2
          </button>
          <button
            type="button"
            onClick={() => handleDigit("3")}
            className="py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold transition"
          >
            3
          </button>
          <button
            type="button"
            onClick={() => handleOperator("+")}
            className="py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-lg transition"
          >
            +
          </button>

          <button
            type="button"
            onClick={() => handleFunc("neg")}
            className="py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold transition"
          >
            ±
          </button>
          <button
            type="button"
            onClick={() => handleDigit("0")}
            className="py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold transition"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleDigit(".")}
            className="py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold transition"
          >
            .
          </button>
          <button
            type="button"
            onClick={handleCalculate}
            className="py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-lg transition"
          >
            =
          </button>
        </div>
      </div>
    </div>
  );
}
