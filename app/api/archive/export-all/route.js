"use client";

import { useState } from "react";
import { CalendarIcon, PrinterIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import JSZip from "jszip";

function csvToHtml(csv) {
  const lines = csv.split("\n").filter((line) => line.trim() !== "");
  if (lines.length === 0) return "";

  // Assume first line is headers
  const headers = lines[0].split(",").map((header) => `<th>${header.trim()}</th>`).join("");
  const rows = lines
    .slice(1)
    .map((line) =>
      line
        .split(",")
        .map((cell) => `<td>${cell.trim()}</td>`)
        .join("")
    )
    .map((row) => `<tr>${row}</tr>`)
    .join("");

  return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
}

export default function Export() {
  const [selectedMonth, setSelectedMonth] = useState("");
  const [printing, setPrinting] = useState(false);

  const handlePrint = async () => {
    if (!selectedMonth) return;
    setPrinting(true);
    try {
      const response = await fetch(`/api/archive/download?month=${selectedMonth}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch data: ${response.status} ${response.statusText} - ${errorText}`);
      }
      const text = await response.text();
      const htmlContent = `<h1>Room Event Data - ${selectedMonth}</h1>${csvToHtml(text)}`;

      const newWin = window.open("");
      if (!newWin) throw new Error("Failed to open new window");
      newWin.document.write(`
        <html>
          <head>
            <title>Print Room Event Data</title>
            <style>
              body { font-family: Arial, sans-serif; }
              table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
              th, td { border: 1px solid black; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
            </style>
          </head>
          <body>${htmlContent}</body>
        </html>
      `);
      newWin.document.close();
      newWin.print();
    } catch (error) {
      console.error("Error printing data:", error);
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintAll = async () => {
    setPrinting(true);
    try {
      const response = await fetch(`/api/archive/export-all`); // Fixed endpoint
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch all data: ${response.status} ${response.statusText} - ${errorText}`);
      }
      const blob = await response.blob();
      const zip = await JSZip.loadAsync(blob);

      let htmlContent = "";
      for (const filename in zip.files) {
        const file = zip.files[filename];
        if (file.dir) continue;
        const text = await file.async("text");
        htmlContent += `<h2>${filename}</h2>${csvToHtml(text)}`;
      }

      const newWin = window.open("");
      if (!newWin) throw new Error("Failed to open new window");
      newWin.document.write(`
        <html>
          <head>
            <title>Print All Hotel Data</title>
            <style>
              body { font-family: Arial, sans-serif; }
              table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
              th, td { border: 1px solid black; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
            </style>
          </head>
          <body><h1>All Hotel Data</h1>${htmlContent}</body>
        </html>
      `);
      newWin.document.close();
      newWin.print();
    } catch (error) {
      console.error("Error printing all data:", error);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-4">
              <CalendarIcon className="h-6 w-6 text-green-500 mr-2" />
              <h2 className="text-lg font-medium text-gray-900">Monthly Data Print</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Month</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-green-500 focus:border-green-500 text-gray-700"
                />
              </div>
              <button
                onClick={handlePrint}
                disabled={printing || !selectedMonth}
                className={`w-full flex items-center justify-center px-4 py-2 rounded-md ${
                  printing ? "bg-green-400" : "bg-green-600 hover:bg-green-700"
                } text-white`}
              >
                {printing ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                    Printing...
                  </>
                ) : (
                  "Print Room & Event Data"
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-4">
              <PrinterIcon className="h-6 w-6 text-green-500 mr-2" />
              <h2 className="text-lg font-medium text-gray-900">Print All Data</h2>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Print all hotel data</p>
              <button
                onClick={handlePrintAll}
                disabled={printing}
                className={`w-full flex items-center justify-center px-4 py-2 rounded-md ${
                  printing ? "bg-green-400" : "bg-green-600 hover:bg-green-700"
                } text-white`}
              >
                {printing ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                    Printing...
                  </>
                ) : (
                  "Print All Data"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}