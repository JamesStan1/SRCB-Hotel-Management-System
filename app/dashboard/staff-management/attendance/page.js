"use client";

import { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";

// SVG icons (unchanged)
const ClockIcon = ({ className = "h-6 w-6" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const CalendarIcon = ({ className = "h-6 w-6" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const UserGroupIcon = ({ className = "h-6 w-6" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
    />
  </svg>
);

const CheckIcon = ({ className = "h-4 w-4" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    className={className}
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = ({ className = "h-4 w-4" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    className={className}
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default function AttendancePayroll({ isLoading }) {
  const [users, setUsers] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [showClockInScanner, setShowClockInScanner] = useState(false);
  const [showClockOutScanner, setShowClockOutScanner] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString("en-CA"));
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch all users
        const usersRes = await fetch("/api/users");
        if (!usersRes.ok) throw new Error(`Failed to fetch users: ${usersRes.statusText}`);
        const usersData = await usersRes.json();

        // Fetch attendance
        const attRes = await fetch("/api/attendance");
        if (!attRes.ok) throw new Error(`Failed to fetch attendance: ${attRes.statusText}`);
        const attData = await attRes.json();

        setUsers(usersData);
        setAttendanceRecords(attData);
      } catch (error) {
        console.error("Error loading data:", error);
        setErrorMessage(`Failed to load data: ${error.message}`);
      }
    };

    loadData();
  }, []);

  // QR Scanner setup for both clock-in and clock-out
  useEffect(() => {
    let intervalId;

    const startScanner = async (isClockIn) => {
      if ((!showClockInScanner && !showClockOutScanner) || !videoRef.current || !canvasRef.current) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((err) => {
            console.error("Error playing video:", err);
            setErrorMessage("Failed to start video stream: " + err.message);
            setShowClockInScanner(false);
            setShowClockOutScanner(false);
          });
        }

        // Use the DOM canvas if available; otherwise create an offscreen canvas
        // so getContext() won't throw when the ref isn't set yet (race condition
        // between modal mount and media stream start).
        let canvas = canvasRef.current;
        let createdTempCanvas = null;
        if (!canvas) {
          createdTempCanvas = document.createElement("canvas");
          createdTempCanvas.width = 640;
          createdTempCanvas.height = 480;
          canvas = createdTempCanvas;
        }

        const context = canvas && canvas.getContext ? canvas.getContext("2d") : null;
        if (!context) {
          console.warn("Scanner: no canvas context available, aborting scan start");
          return;
        }

        intervalId = setInterval(() => {
          (async () => {
            if (videoRef.current && canvas && context) {
              try {
                // Prefer drawing at the video's actual resolution if available
                const w = canvas.width || (videoRef.current.videoWidth || 640);
                const h = canvas.height || (videoRef.current.videoHeight || 480);
                // When using an offscreen canvas created above, ensure its size matches
                if (createdTempCanvas) {
                  createdTempCanvas.width = w;
                  createdTempCanvas.height = h;
                }
                context.drawImage(videoRef.current, 0, 0, w, h);
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                  inversionAttempts: "dontInvert",
                });

                if (code) {
                  let qrData;
                  try {
                    qrData = JSON.parse(code.data);
                  } catch (err) {
                    setErrorMessage("Invalid QR code data");
                    setTimeout(() => {
                      setShowClockInScanner(false);
                      setShowClockOutScanner(false);
                      stopScanner();
                    }, 1500);
                    return;
                  }

                  if (qrData.system === "JoannaHotelAttendance" && qrData.userId) {
                    let user = users.find((u) => Number(u.id) === Number(qrData.userId));

                    if (!user) {
                      try {
                        const resp = await fetch("/api/users");
                        if (resp.ok) {
                          const allUsers = await resp.json();
                          user = allUsers.find((u) => Number(u.id) === Number(qrData.userId));
                          if (user) {
                            setUsers((prev) => {
                              const exists = prev.some((p) => Number(p.id) === Number(user.id));
                              return exists ? prev : [...prev, user];
                            });
                          }
                        }
                      } catch (err) {
                        console.error("Error fetching users on scan fallback:", err);
                      }
                    }

                    if (user) {
                      if (isClockIn) {
                        handleClockIn(qrData.userId, user.name);
                      } else {
                        handleClockOut(qrData.userId, user.name);
                      }
                      setShowClockInScanner(false);
                      setShowClockOutScanner(false);
                      stopScanner();
                    } else {
                      setErrorMessage("User not found in system");
                      setTimeout(() => {
                        setShowClockInScanner(false);
                        setShowClockOutScanner(false);
                        stopScanner();
                      }, 3000);
                    }
                  } else {
                    setErrorMessage("Invalid QR code for this system");
                    setTimeout(() => {
                      setShowClockInScanner(false);
                      setShowClockOutScanner(false);
                      stopScanner();
                    }, 3000);
                  }
                }
              } catch (err) {
                console.error("Scanner loop error:", err);
                setErrorMessage("Scanner error: " + (err.message || err));
                setTimeout(() => {
                  setShowClockInScanner(false);
                  setShowClockOutScanner(false);
                  stopScanner();
                }, 1500);
              }
            }
          })();
        }, 100);
      } catch (err) {
        console.error("Error accessing camera:", err);
        setErrorMessage("Failed to access camera: " + err.message);
        setShowClockInScanner(false);
        setShowClockOutScanner(false);
      }
    };

    if (showClockInScanner || showClockOutScanner) {
      startScanner(showClockInScanner);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      stopScanner();
    };
  }, [showClockInScanner, showClockOutScanner, users, attendanceRecords]);

  const stopScanner = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const handleClockIn = async (userId, userName) => {
    try {
      // Send the browser's local time to the server so the stored clock-in
      // matches the user's local time and avoids timezone offsets from the DB/server.
      const localTime = new Date().toLocaleTimeString("en-GB", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      const res = await fetch("/api/attendance/clock-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, clockInTime: localTime }),
      });

      const data = await res.json();
      if (res.ok) {
        // Use returned clockInTime when available to show the accurate recorded time
        const displayTime = data.clockInTime ? formatTime(data.clockInTime) : new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
        if (data.alreadyClockedIn) {
          // Friendly idempotent message when trying to clock in again
          setSuccessMessage(`${userName} already clocked in at ${displayTime}`);
        } else {
          setSuccessMessage(`${userName} clocked in successfully at ${displayTime}`);
        }
        setTimeout(() => setSuccessMessage(null), 5000);
        // Refresh the table so the new row appears (server is canonical)
        await refreshAttendance();
      } else {
        // On error, the server may still provide an existing clockInTime
        const existingTime = data.clockInTime ? formatTime(data.clockInTime) : null;
        setErrorMessage(`Clock-in failed: ${data.error}${existingTime ? ` (Clocked in at ${existingTime})` : ""}`);
        setTimeout(() => setErrorMessage(null), 5000);
      }
    } catch (err) {
      console.error("Clock-in error:", err);
      setErrorMessage("Failed to clock in: " + err.message);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const handleClockOut = async (userId, userName) => {
    try {
      // Send the client's local time so the server records the real time
      const localTime = new Date().toLocaleTimeString("en-GB", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      const response = await fetch("/api/attendance/clock-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, clockOutTime: localTime }),
      });

      const data = await response.json();
      if (data.error) {
        setErrorMessage(data.error);
        setTimeout(() => setErrorMessage(null), 5000);
        return;
      }

      const hoursWorked = Number(data.hoursWorked || 0);
      const formattedHours = hoursWorked.toFixed(2);
      const overtime = Number(data.overtimeHours || 0);
      const formattedOvertime = overtime > 0 ? ` (Overtime: ${overtime.toFixed(2)} hrs)` : "";

      // Prefer the server-returned time (data.time). If missing, fall back to
      // the client's localTime we sent above. Use formatTime to show 12-hour
      // exact-minute display.
      const displayTime = data.time ? formatTime(data.time) : formatTime(localTime);

      setSuccessMessage(
        `${userName} clocked out successfully at ${displayTime}. Hours worked: ${formattedHours}${formattedOvertime}`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
      await refreshAttendance();
    } catch (error) {
      console.error("Frontend clock-out error:", error);
      setErrorMessage("Failed to clock out: " + error.message);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const refreshAttendance = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/attendance");
      if (!res.ok) throw new Error(`Failed to fetch attendance: ${res.statusText}`);
      const data = await res.json();
      setAttendanceRecords(data);
    } catch (err) {
      console.error("Failed to refresh attendance:", err);
      setErrorMessage("Failed to refresh attendance: " + err.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredRecords = attendanceRecords.filter((record) => {
    const recordDate = new Date(record.date).toLocaleDateString("en-CA");
    return recordDate === selectedDate;
  });

  const formatTime = (timeString) => {
    if (!timeString) return "--:--";
    // Parse the DB time as a local time (avoid forcing UTC with 'Z') so the
    // displayed time matches the client's timezone.
    // Show 12-hour format with AM/PM, e.g. "3:56 PM". Preserve exact minute
    // values from the stored time string. If parsing fails, fall back to
    // locale-based 12-hour formatting.
    try {
      const parts = timeString.split(":");
      if (parts.length >= 2) {
        const hour = String(parseInt(parts[0], 10)); // removes any leading zero
        const minute = parts[1].padStart(2, "0");
        let hour12 = parseInt(hour, 10);
        const ampm = hour12 >= 12 ? "PM" : "AM";
        hour12 = hour12 % 12;
        if (hour12 === 0) hour12 = 12; // midnight/noon -> 12
        return `${hour12}:${minute} ${ampm}`;
      }
    } catch (err) {
      // Fallback to previous behavior if parsing fails
      try {
        return new Date(`1970-01-01T${timeString}`).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      } catch (e) {
        return timeString;
      }
    }
    return timeString;
  };

  const computeHoursFromRecord = (record) => {
    try {
      if (!record) return 0;
      const inTime = record.clock_in;
      const outTime = record.clock_out;
      if (!inTime || !outTime) return 0;

      // Use the record date if available, otherwise use the selectedDate
      const dateStr = record.date ? new Date(record.date).toLocaleDateString("en-CA") : selectedDate;

      const start = new Date(`${dateStr}T${inTime}`);
      let end = new Date(`${dateStr}T${outTime}`);
      if (end <= start) {
        // crossed midnight
        end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      }
      const hours = Math.abs(end - start) / 36e5;
      return +hours.toFixed(2);
    } catch (err) {
      console.error("computeHoursFromRecord error:", err);
      return 0;
    }
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    if (newDate) {
      setSelectedDate(newDate);
    }
  };

  return (
    <div className="p-6">
      {errorMessage && (
        <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-lg flex justify-between items-center">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-red-800 font-bold">
            X
          </button>
        </div>
      )}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-100 text-green-800 rounded-lg flex justify-between items-center">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-green-800 font-bold">
            X
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
              <UserGroupIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Users</p>
              <p className="text-2xl font-semibold text-gray-800">{users.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
              <ClockIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Present on {selectedDate}</p>
              <p className="text-2xl font-semibold text-gray-800">
                {filteredRecords.filter((record) => record.status === "present").length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600 mr-4">
              <CalendarIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Absent on {selectedDate}</p>
              <p className="text-2xl font-semibold text-gray-800">
                {users.length - filteredRecords.filter((record) => record.status === "present").length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0 mb-6 items-start sm:items-center">
        <div className="flex items-center space-x-2">
          <label htmlFor="dateFilter" className="text-sm font-medium text-gray-700">
            Select Date:
          </label>
          <input
            id="dateFilter"
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="text-black px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            max={new Date().toLocaleDateString("en-CA")}
          />
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowClockInScanner(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            Clock In with QR
          </button>
          <button
            onClick={() => setShowClockOutScanner(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Clock Out with QR
          </button>
          <button
            onClick={refreshAttendance}
            disabled={isRefreshing}
            aria-busy={isRefreshing}
            className={`px-4 py-2 rounded-md transition-colors ${isRefreshing ? 'bg-blue-400 text-white cursor-wait' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            {isRefreshing ? (
              <span className="flex items-center space-x-2">
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                <span>Refreshing...</span>
              </span>
            ) : (
              'Refresh Data'
            )}
          </button>
        </div>
      </div>

      {showClockInScanner && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg w-full relative">
            {/* Close button - top right corner */}
            <button
              onClick={() => {
                setShowClockInScanner(false);
                stopScanner();
              }}
              className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold mb-4">Clock In QR Scanner</h2>
            <p className="text-sm text-gray-600 mb-4">Point your camera at the QR code to clock in</p>
            <div className="relative w-full h-64 bg-gray-200 rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
              ></video>
              <canvas ref={canvasRef} className="hidden" width="640" height="480"></canvas>
            </div>
            <div className="flex space-x-2 mt-4">
              <button
                onClick={() => {
                  setShowClockInScanner(false);
                  stopScanner();
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showClockOutScanner && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg w-full relative">
            {/* Close button - top right corner */}
            <button
              onClick={() => {
                setShowClockOutScanner(false);
                stopScanner();
              }}
              className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-2 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold mb-4">Clock Out QR Scanner</h2>
            <p className="text-sm text-gray-600 mb-4">Point your camera at the QR code to clock out</p>
            <div className="relative w-full h-64 bg-gray-200 rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
              ></video>
              <canvas ref={canvasRef} className="hidden" width="640" height="480"></canvas>
            </div>
            <div className="flex space-x-2 mt-4">
              <button
                onClick={() => {
                  setShowClockOutScanner(false);
                  stopScanner();
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-green-700 mb-4">Attendance for {selectedDate}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Clock In/Out
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hours Worked
                </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Overtime
                  </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                  users.map((user) => {
                  const record = filteredRecords.find((r) => Number(r.user_id) === Number(user.id)) || {};
                  // Prefer computing hours from clock_in/clock_out when present
                  const computedHours = computeHoursFromRecord(record);
                  const hoursWorkedVal = computedHours > 0 ? computedHours : (record.hours_worked ? Number(record.hours_worked) : 0);
                  const hoursWorked = hoursWorkedVal ? hoursWorkedVal.toFixed(2) : 0;
                  const overtimeVal = hoursWorkedVal > 8 ? +(hoursWorkedVal - 8).toFixed(2) : 0;

                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium">
                              {user.name?.charAt(0)?.toUpperCase() || "U"}
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                            <div className="text-sm text-gray-500">{user.email || "N/A"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.role || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {record.status === "present" ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Present
                          </span>
                        ) : filteredRecords.some((r) => Number(r.user_id) === Number(user.id)) ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            Partial
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                            Absent
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-2">
                          {record.clock_in ? (
                            <>
                              <CheckIcon className="h-4 w-4 text-green-500" />
                              <span>{formatTime(record.clock_in)}</span>
                            </>
                          ) : (
                            <>
                              <XIcon className="h-4 w-4 text-red-500" />
                              <span>--:--</span>
                            </>
                          )}
                          <span>/</span>
                          {record.clock_out ? (
                            <>
                              <CheckIcon className="h-4 w-4 text-green-500" />
                              <span>{formatTime(record.clock_out)}</span>
                            </>
                          ) : (
                            <>
                              <XIcon className="h-4 w-4 text-red-500" />
                              <span>--:--</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {hoursWorked > 0 ? (
                          <span className="flex items-center">
                            <ClockIcon className="h-4 w-4 mr-1 text-gray-700" />
                            {hoursWorked} hrs
                          </span>
                        ) : (
                          "--"
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {overtimeVal > 0 ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">{overtimeVal} hrs</span>
                        ) : (
                          "--"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}