import React, { useState, useEffect } from 'react';
import { Users, UserPlus, FileText, Activity, LogOut, Menu, X, Stethoscope, Calendar, Plus, AlertCircle } from 'lucide-react';

// ==================== API CONFIGURATION ====================
const API_CONFIG = {
  // Master switch - set to false to disable all API calls
  isOnline: true,
  
  // Base URL for API
  baseUrl: 'http://localhost:8080',
  
  // Individual endpoint toggles
  endpoints: {
    login: true,              // POST /auth/login
    fetchDoctors: true,       // GET /admin/doctors
    createDoctor: true,       // POST /admin/create-doctor
    fetchPatients: true,      // GET /doctor/patients/{doctorId}
    createPatient: true,      // POST /doctor/create-patient
    fetchRecords: true,       // GET /doctor/records/{patientId}
    addRecord: true,          // POST /doctor/add-record
  }
};

// Mock data for offline mode
const MOCK_DATA = {
  users: [
    { email: 'admin@hospital.com', password: 'admin123', role: 'ADMIN', name: 'Admin User', userId: '1' },
    { email: 'doctor@hospital.com', password: 'doctor123', role: 'DOCTOR', name: 'Dr. Sarah Johnson', userId: '2', doctorProfileId: '1' }
  ],
  doctors: [
    { id: '1', fullName: 'Dr. Sarah Johnson', specialty: 'Cardiology', phoneNumber: '+1 555-0101', clinicAddress: '123 Medical Plaza', email: 'doctor@hospital.com' },
    { id: '2', fullName: 'Dr. Michael Chen', specialty: 'Pediatrics', phoneNumber: '+1 555-0102', clinicAddress: '456 Health Center' }
  ],
  patients: [
    { id: '1', fullName: 'John Smith', gender: 'Male', phoneNumber: '+1 555-0201', address: '789 Oak Street', email: 'john@email.com' },
    { id: '2', fullName: 'Emma Wilson', gender: 'Female', phoneNumber: '+1 555-0202', address: '321 Pine Avenue', email: 'emma@email.com' }
  ],
  records: [
    { id: '1', patientId: '1', inr: 2.5, dose: 5.00, notes: 'Monitor blood pressure weekly', recordDate: '2024-12-01', patient: { fullName: 'John Smith' } },
    { id: '2', patientId: '2', inr: 3.2, dose: 4.00, notes: 'Follow-up in 3 months', recordDate: '2024-12-10', patient: { fullName: 'Emma Wilson' } }
  ]
};

const AdminPortal = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [records, setRecords] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dob, setDob] = useState("");


  // Auto-dismiss alerts
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Fetch doctors when admin logs in
  useEffect(() => {
    if (currentUser?.role === 'ADMIN') {
      fetchDoctors();
    }
  }, [currentUser]);

  useEffect(() => {
  if (
    currentView === "patients" &&
    currentUser?.role === "DOCTOR"
  ) {
    const doctorId = localStorage.getItem("userId");
    if (doctorId) {
      fetchPatients(doctorId);
    }
  }
}, [currentView]);

  // Fetch patients when doctor logs in
  useEffect(() => {
    if (currentUser?.role === 'DOCTOR' && currentUser?.doctorProfileId) {
      const userId = localStorage.getItem("userId");
      if (userId) {
        fetchPatients(userId);
      }
    }
  }, [currentUser?.role, currentUser?.doctorProfileId]);

  // Helper function to check if endpoint is enabled
  const isEndpointEnabled = (endpoint) => {
    return API_CONFIG.isOnline && API_CONFIG.endpoints[endpoint];
  };

  // Helper function to create auth headers
  const getAuthHeaders = () => {
    if (!credentials) return {};
    
    const basicAuth = btoa(`${credentials.email}:${credentials.password}`);
    return {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/json'
    };
  };

  const calculateAge = (dob) => {
  if (!dob) return "";
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  };

  const VALVE_TYPES = [
    "mitral",
    "Arotic",
  ];


  // ========== API CALLS ==========

  // Login - /auth/login
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const email = e.target.email.value;
    const password = e.target.password.value;

    // OFFLINE MODE or endpoint disabled
    if (!isEndpointEnabled('login')) {
      setTimeout(() => {
        const mockUser = MOCK_DATA.users.find(u => u.email === email && u.password === password);
        
        if (mockUser) {
          const creds = { email, password };
          setCredentials(creds);
          localStorage.setItem("userId", mockUser.userId);
          
          setCurrentUser({
            email: mockUser.email,
            role: mockUser.role,
            name: mockUser.name,
            doctorProfileId: mockUser.doctorProfileId
          });
          
          setCurrentView("dashboard");
          setSuccess("Login successful! (OFFLINE MODE)");
        } else {
          setError("Invalid credentials (OFFLINE MODE)");
        }
        setLoading(false);
      }, 500);
      return;
    }

    try {
      // ONLINE MODE
      const response = await fetch(`${API_CONFIG.baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (response.ok && result.msg === "Login successful") {
        const creds = { email, password };
        setCredentials(creds);
        localStorage.setItem("userId", result.userId)

        let role = result.role;

        if (role.includes("ADMIN")) role = "ADMIN";
        else if(role.includes("PATIENT")) role = "PATIENT";
        else role = "DOCTOR"

        if (role === "DOCTOR") {
          const basicAuth = btoa(`${email}:${password}`);

          const doctorsRes = await fetch(`${API_CONFIG.baseUrl}/admin/doctors`, {
            headers: { Authorization: `Basic ${basicAuth}` },
          });

          const allDoctors = await doctorsRes.json();

          const doctorProfile = allDoctors.find(
            (d) =>
              d.user?.email === email ||
              d.email === email
          );

          setCurrentUser({
            email,
            role,
            name: doctorProfile?.fullName || "Doctor",
            doctorProfileId: doctorProfile?.id,
          });
        } else {
          setCurrentUser({
            email,
            role,
            name: "Admin User",
          });
        }

        setCurrentView("dashboard");
        setSuccess("Login successful!");
      } else {
        setError(result.msg || "Login failed");
      }
    } catch (err) {
      setError("Connection failed. Make sure backend is running on port 8080");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all doctors - /admin/doctors
  const fetchDoctors = async () => {
    // OFFLINE MODE or endpoint disabled
    if (!isEndpointEnabled('fetchDoctors')) {
      setTimeout(() => {
        setDoctors(MOCK_DATA.doctors);
        setLoading(false);
      }, 300);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_CONFIG.baseUrl}/admin/doctors`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setDoctors(data);
      } else if (response.status === 401 || response.status === 403) {
        setError('Unauthorized access. Please login again.');
      } else {
        setError('Failed to fetch doctors');
      }
    } catch (err) {
      setError('Failed to connect to backend');
      console.error('Fetch doctors error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Create Doctor - /admin/create-doctor
  const handleCreateDoctor = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    const formData = new FormData(e.target);
    
    // OFFLINE MODE or endpoint disabled
    if (!isEndpointEnabled('createDoctor')) {
      setTimeout(() => {
        const newDoctor = {
          id: String(MOCK_DATA.doctors.length + 1),
          fullName: formData.get('fullName'),
          specialty: formData.get('specialty'),
          phoneNumber: formData.get('phone'),
          clinicAddress: formData.get('clinicAddress'),
          email: formData.get('email')
        };
        MOCK_DATA.doctors.push(newDoctor);
        setSuccess('Doctor created successfully! (OFFLINE MODE)');
        e.target.reset();
        setDoctors([...MOCK_DATA.doctors]);
        setCurrentView('doctors');
        setLoading(false);
      }, 500);
      return;
    }

    const params = new URLSearchParams({
      email: formData.get('email'),
      password: formData.get('password'),
      fullName: formData.get('fullName'),
      specialty: formData.get('specialty'),
      phone: formData.get('phone'),
      clinicAddress: formData.get('clinicAddress')
    });

    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/admin/create-doctor?${params}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const result = await response.text();
        setSuccess(result);
        e.target.reset();
        await fetchDoctors();
        setCurrentView('doctors');
      } else if (response.status === 401 || response.status === 403) {
        setError('Unauthorized. Only admins can create doctors.');
      } else {
        const result = await response.text();
        setError(result);
      }
    } catch (err) {
      setError('Failed to create doctor');
      console.error('Create doctor error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch patients for a doctor - /doctor/patients/{doctorId}
  const fetchPatients = async (doctorId) => {
    // OFFLINE MODE or endpoint disabled
    if (!isEndpointEnabled('fetchPatients')) {
      setTimeout(() => {
        setPatients(MOCK_DATA.patients);
        setLoading(false);
      }, 300);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_CONFIG.baseUrl}/doctor/patients/${doctorId}`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setPatients(data);
      } else if (response.status === 401 || response.status === 403) {
        setError('Unauthorized access. Please login again.');
      } else {
        setError('Failed to fetch patients');
      }
    } catch (err) {
      setError('Failed to connect to backend');
      console.error('Fetch patients error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Create Patient - /doctor/create-patient
  const handleCreatePatient = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    const formData = new FormData(e.target);
    
    // OFFLINE MODE or endpoint disabled
    if (!isEndpointEnabled('createPatient')) {
      setTimeout(() => {
        const newPatient = {
          id: String(MOCK_DATA.patients.length + 1),
          fullName: formData.get('fullName'),
          gender: formData.get('gender'),
          phoneNumber: formData.get('phone'),
          address: formData.get('address'),
          email: formData.get('email')
        };
        MOCK_DATA.patients.push(newPatient);
        setSuccess('Patient created successfully! (OFFLINE MODE)');
        e.target.reset();
        setPatients([...MOCK_DATA.patients]);
        setCurrentView('patients');
        setLoading(false);
      }, 500);
      return;
    }

    const params = new URLSearchParams({
      email: formData.get('email'),
      password: formData.get('password'),
      fullName: formData.get('fullName'),
      gender: formData.get('gender'),
      phone: formData.get('phone'),
      address: formData.get('address'),
      doctorId: localStorage.getItem("userId"),
      dob: formData.get("dob"),
      valveType: formData.get("valveType"),
    });

    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/doctor/create-patient?${params}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const result = await response.text();
        setSuccess(result);
        e.target.reset();
        await fetchPatients(localStorage.getItem("userId"));
        setCurrentView('patients');
      } else if (response.status === 401 || response.status === 403) {
        setError('Unauthorized. Only doctors can create patients.');
      } else {
        const result = await response.text();
        setError(result);
      }
    } catch (err) {
      setError('Failed to create patient');
      console.error('Create patient error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch records for a patient - /doctor/records/{patientId}
  const fetchRecords = async (patientId) => {
    // OFFLINE MODE or endpoint disabled
    if (!isEndpointEnabled('fetchRecords')) {
      setTimeout(() => {
        const patientRecords = MOCK_DATA.records.filter(r => r.patientId === patientId);
        setRecords(patientRecords);
        setLoading(false);
      }, 300);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_CONFIG.baseUrl}/doctor/records/${patientId}`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setRecords(data);
      } else if (response.status === 401 || response.status === 403) {
        setError('Unauthorized access.');
      } else {
        setError('Failed to fetch records');
      }
    } catch (err) {
      setError('Failed to connect to backend');
      console.error('Fetch records error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Add Patient Record - /doctor/add-record
  const handleAddRecord = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    const formData = new FormData(e.target);
    
    // OFFLINE MODE or endpoint disabled
    if (!isEndpointEnabled('addRecord')) {
      setTimeout(() => {
        const newRecord = {
          id: String(MOCK_DATA.records.length + 1),
          inr: selectedPatient.id,
          dose: formData.get('inr'),
          treatment: formData.get('dose'),
          notes: formData.get('notes') || '',
          recordDate: new Date().toISOString().split('T')[0],
          patient: { fullName: selectedPatient.fullName }
        };
        MOCK_DATA.records.push(newRecord);
        setSuccess('Record added successfully! (OFFLINE MODE)');
        e.target.reset();
        const patientRecords = MOCK_DATA.records.filter(r => r.patientId === selectedPatient.id);
        setRecords(patientRecords);
        setCurrentView('records');
        setLoading(false);
      }, 500);
      return;
    }

    const params = new URLSearchParams({
      patientId: selectedPatient.id,
      doctorId: localStorage.getItem("userId"),
      inr: formData.get('inr'),
      dose: formData.get('dose'),
      notes: formData.get('notes') || ''
    });

    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/doctor/add-record?${params}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const result = await response.text();
        setSuccess(result);
        e.target.reset();
        await fetchRecords(selectedPatient.id);
        setCurrentView('records');
      } else if (response.status === 401 || response.status === 403) {
        setError('Unauthorized. Only doctors can add records.');
      } else {
        const result = await response.text();
        setError(result);
      }
    } catch (err) {
      setError('Failed to add record');
      console.error('Add record error:', err);
    } finally {
      setLoading(false);
    }
  };

  // View all records for doctor
  const handleViewAllRecords = async () => {
    // OFFLINE MODE or endpoint disabled
    if (!isEndpointEnabled('fetchRecords')) {
      setTimeout(() => {
        setRecords(MOCK_DATA.records);
        setCurrentView('records');
        setLoading(false);
      }, 300);
      return;
    }

    try {
      setLoading(true);
      const allRecords = [];
      for (const patient of patients) {
        const response = await fetch(`${API_CONFIG.baseUrl}/doctor/records/${patient.id}`, {
          headers: getAuthHeaders()
        });
        if (response.ok) {
          const data = await response.json();
          allRecords.push(...data);
        }
      }
      setRecords(allRecords);
      setCurrentView('records');
    } catch (err) {
      setError('Failed to fetch records');
      console.error('Fetch all records error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ========== UI COMPONENTS ==========

  // Alert Component
  const Alert = ({ type, message, onClose }) => (
    <div className={`fixed top-4 right-4 z-50 max-w-md p-4 rounded-lg shadow-lg animate-slide-in ${
      type === 'error' ? 'bg-red-50 border-2 border-red-200' : 'bg-green-50 border-2 border-green-200'
    }`}>
      <div className="flex items-center gap-3">
        <AlertCircle className={type === 'error' ? 'text-red-600' : 'text-green-600'} size={20} />
        <p className={`flex-1 ${type === 'error' ? 'text-red-800' : 'text-green-800'}`}>{message}</p>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X size={20} />
        </button>
      </div>
    </div>
  );

  // Login Screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
        {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}
        
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="text-white" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Healthcare Portal</h1>
            <p className="text-gray-600">Admin & Doctor Management System</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                name="email"
                placeholder="your-email@hospital.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                name="password"
                placeholder="Enter your password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-700 mb-2"><strong>Using Basic Authentication</strong></p>
            <p className="text-xs text-gray-600">All requests are authenticated with your credentials</p>
          </div>
          
          {/* API Configuration Status */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">API Configuration</p>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                API_CONFIG.isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {API_CONFIG.isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              <p><strong>Base URL:</strong> {API_CONFIG.baseUrl}</p>
              <details className="mt-2">
                <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-semibold">
                  Endpoint Status
                </summary>
                <div className="mt-2 pl-4 space-y-1">
                  {Object.entries(API_CONFIG.endpoints).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-gray-600">{key}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        value && API_CONFIG.isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {value && API_CONFIG.isOnline ? '✓' : '✗'}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Sidebar Navigation
  const Sidebar = () => {
    const adminMenuItems = [
      { id: 'dashboard', label: 'Dashboard', icon: Activity },
      { id: 'doctors', label: 'Doctors', icon: Stethoscope },
      { id: 'create-doctor', label: 'Add Doctor', icon: UserPlus },
    ];

    const doctorMenuItems = [
      { id: 'dashboard', label: 'Dashboard', icon: Activity },
      { id: 'patients', label: 'My Patients', icon: Users },
      { id: 'create-patient', label: 'Add Patient', icon: UserPlus },
      { id: 'records', label: 'Medical Records', icon: FileText },
    ];

    const menuItems = currentUser.role === 'ADMIN' ? adminMenuItems : doctorMenuItems;

    return (
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-gradient-to-b from-gray-900 to-gray-800 text-white transition-all duration-300 overflow-hidden`}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 w-10 h-10 rounded-lg flex items-center justify-center">
              <Activity size={24} />
            </div>
            <div>
              <h2 className="font-bold text-lg">MediPortal</h2>
              <p className="text-xs text-gray-400">{currentUser.role}</p>
            </div>
          </div>
          
          <nav className="space-y-2">
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id);
                  if (item.id === 'records' && currentUser.role === 'DOCTOR') {
                    handleViewAllRecords();
                  }
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  currentView === item.id 
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg' 
                    : 'hover:bg-gray-700'
                }`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          
          <button
            onClick={() => {
              setCurrentUser(null);
              setCredentials(null);
              setDoctors([]);
              setPatients([]);
              setRecords([]);
              setCurrentView('login');
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-600 transition-all mt-8"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    );
  };

  // Dashboard View
  const Dashboard = () => (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-8">
        Welcome, {currentUser.name}
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {currentUser.role === 'ADMIN' ? (
          <>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl">
              <Stethoscope className="mb-4" size={40} />
              <h3 className="text-4xl font-bold mb-2">{doctors.length}</h3>
              <p className="text-blue-100">Total Doctors</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
              <Users className="mb-4" size={40} />
              <h3 className="text-4xl font-bold mb-2">
                {doctors.reduce((sum, d) => sum + (d.patients || 0), 0)}
              </h3>
              <p className="text-purple-100">Total Patients</p>
            </div>
            <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl p-6 text-white shadow-xl">
              <FileText className="mb-4" size={40} />
              <h3 className="text-4xl font-bold mb-2">{records.length}</h3>
              <p className="text-pink-100">Medical Records</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-xl">
              <Users className="mb-4" size={40} />
              <h3 className="text-4xl font-bold mb-2">{patients.length}</h3>
              <p className="text-green-100">My Patients</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl">
              <FileText className="mb-4" size={40} />
              <h3 className="text-4xl font-bold mb-2">{records.length}</h3>
              <p className="text-blue-100">Medical Records</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
              <Calendar className="mb-4" size={40} />
              <h3 className="text-4xl font-bold mb-2">Today</h3>
              <p className="text-purple-100">{new Date().toLocaleDateString()}</p>
            </div>
          </>
        )}
      </div>
      
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentUser.role === 'ADMIN' ? (
            <>
              <button
                onClick={() => setCurrentView('create-doctor')}
                className="flex items-center gap-3 p-4 border-2 border-blue-200 rounded-xl hover:bg-blue-50 transition-all"
              >
                <UserPlus className="text-blue-600" size={24} />
                <span className="font-semibold text-gray-700">Add New Doctor</span>
              </button>
              <button
                onClick={() => setCurrentView('doctors')}
                className="flex items-center gap-3 p-4 border-2 border-purple-200 rounded-xl hover:bg-purple-50 transition-all"
              >
                <Stethoscope className="text-purple-600" size={24} />
                <span className="font-semibold text-gray-700">View All Doctors</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setCurrentView('create-patient')}
                className="flex items-center gap-3 p-4 border-2 border-green-200 rounded-xl hover:bg-green-50 transition-all"
              >
                <UserPlus className="text-green-600" size={24} />
                <span className="font-semibold text-gray-700">Add New Patient</span>
              </button>
              <button
                onClick={() => setCurrentView('patients')}
                className="flex items-center gap-3 p-4 border-2 border-blue-200 rounded-xl hover:bg-blue-50 transition-all"
              >
                <Users className="text-blue-600" size={24} />
                <span className="font-semibold text-gray-700">View My Patients</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // Doctors List (Admin)
  const DoctorsList = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">All Doctors</h1>
        <button
          onClick={() => setCurrentView('create-doctor')}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all"
        >
          <Plus size={20} />
          Add Doctor
        </button>
      </div>
      
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading doctors...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {doctors.map(doctor => (
            <div key={doctor.id} className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl">
                  {doctor.fullName?.charAt(0) || 'D'}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">{doctor.fullName}</h3>
                  <p className="text-sm text-gray-600">{doctor.specialty}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <p><strong>Phone:</strong> {doctor.phoneNumber}</p>
                <p><strong>Clinic:</strong> {doctor.clinicAddress}</p>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <span className="text-blue-600 font-semibold">ID: {doctor.id}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {!loading && doctors.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Stethoscope size={64} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg">No doctors added yet</p>
          <button
            onClick={() => setCurrentView('create-doctor')}
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Add First Doctor
          </button>
        </div>
      )}
    </div>
  );

  // Create Doctor Form (Admin)
  const CreateDoctorForm = () => (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Add New Doctor</h1>
      
      <form onSubmit={handleCreateDoctor} className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
            <input
              type="text"
              name="fullName"
              placeholder="Dr. John Smith"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
            <input
              type="email"
              name="email"
              placeholder="doctor@hospital.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
            <input
              type="password"
              name="password"
              placeholder="Secure password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Specialty *</label>
            <input
              type="text"
              name="specialty"
              placeholder="e.g., Cardiology"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
            <input
              type="tel"
              name="phone"
              placeholder="+1 234 567 8900"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Clinic Address *</label>
            <input
              type="text"
              name="clinicAddress"
              placeholder="123 Medical St, City"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>
        
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Doctor'}
          </button>
          <button
            type="button"
            onClick={() => setCurrentView('doctors')}
            className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );

  // Patients List (Doctor)
  const PatientsList = () => {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">My Patients</h1>
          <button
            onClick={() => setCurrentView("create-patient")}
            className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all"
          >
            <Plus size={20} />
            Add Patient
          </button>
        </div>
  
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading patients...</p>
          </div>
        ) : patients.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {patients.map((patient) => (
              <div key={patient.id} className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all">
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-gradient-to-r from-green-500 to-blue-500 w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl">
                    {patient.fullName?.charAt(0) || "P"}
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-gray-800">{patient.fullName}</h2>
                    <p className="text-sm text-gray-600">{patient.gender}</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p><strong>Valve Type : {patient.valveType }</strong></p>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <span className="text-green-600 font-semibold">Patient ID: {patient.id}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => {
                      setSelectedPatient(patient);
                      setCurrentView("add-record");
                    }}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-all"
                  >
                    Add Record
                  </button>
                  <button
                    onClick={async () => {
                      await fetchRecords(patient.id);
                      setSelectedPatient(patient);
                      setCurrentView("patient-records");
                    }}
                    className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-all"
                  >
                    View Records
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Users size={64} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">No patients assigned yet</p>
            <button
              onClick={() => setCurrentView("create-patient")}
              className="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
            >
              Add First Patient
            </button>
          </div>
        )}
      </div>
    );
  };

  // Create Patient Form (Doctor)
  const CreatePatientForm = () => (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Add New Patient</h1>
      
      <form onSubmit={handleCreatePatient} className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
            <input
              type="text"
              name="fullName"
              placeholder="John Doe"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
            <input
              type="email"
              name="email"
              placeholder="patient@email.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
            <input
              type="password"
              name="password"
              placeholder="Secure password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Gender *</label>
            <select
              name="gender"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              required
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Date of Birth *</label>
            <input
              type="date"
              name="dob"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Age</label>
            <input
              type="text"
              value={calculateAge(dob)}
              readOnly
              className="w-full px-4 py-3 border rounded-lg bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Valve Type *</label>
            <select
              name="valveType"
              className="w-full px-4 py-3 border rounded-lg"
              required
            >
              <option value="">Select Valve Type</option>
              {VALVE_TYPES.map((valve) => (
                <option key={valve} value={valve}>
                  {valve}
                </option>
              ))}
            </select>
          </div>


          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
            <input
              type="tel"
              name="phone"
              placeholder="+1 234 567 8900"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Address *</label>
            <input
              type="text"
              name="address"
              placeholder="123 Main St, City"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
        </div>
        
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Patient'}
          </button>
          <button
            type="button"
            onClick={() => setCurrentView('patients')}
            className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );

  // Add Record Form (Doctor)
  const AddRecordForm = () => (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        Add Medical Record for {selectedPatient?.fullName}
      </h1>
      
      <form onSubmit={handleAddRecord} className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current INR</label>
            <input
              type="number"
              name="inr"
              placeholder="2.5"
              step="0.01"
              min="0"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current DOSE</label>
            <input
              type="number"
              name="dose"
              step="0.01"
              min="0"
              placeholder="0.00 mg"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              name="notes"
              rows="4"
              placeholder="Additional observations, follow-up instructions, etc."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? 'Adding Record...' : 'Add Record'}
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedPatient(null);
              setCurrentView('patients');
            }}
            className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );

  // Records List (Doctor)
  const RecordsList = () => (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        {selectedPatient ? `Medical Records for ${selectedPatient.fullName}` : 'All Medical Records'}
      </h1>
      
      {selectedPatient && (
        <button
          onClick={() => {
            setSelectedPatient(null);
            handleViewAllRecords();
          }}
          className="mb-4 text-blue-600 hover:text-blue-800 font-semibold"
        >
          ← Back to All Records
        </button>
      )}
      
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading records...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map(record => (
            <div key={record.id} className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg text-gray-800">
                    {record.patient?.fullName || selectedPatient?.fullName || 'Patient'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    by {record.doctorProfile?.fullName || currentUser.name}
                  </p>
                </div>
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                  {record.recordDate || new Date().toLocaleDateString()}
                </span>
              </div>
              <div className="space-y-3 text-gray-700">
                <div>
                  <strong className="text-gray-900">INR:</strong>
                  <p className="mt-1">{record.inr}</p>
                </div>
                <div>
                  <strong className="text-gray-900">DOSE:</strong>
                  <p className="mt-1">{record.dose} mg</p>
                </div>
                {record.notes && (
                  <div>
                    <strong className="text-gray-900">Notes:</strong>
                    <p className="mt-1">{record.notes}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {!loading && records.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <FileText size={64} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg">No medical records added yet</p>
          {selectedPatient && (
            <button
              onClick={() => setCurrentView('add-record')}
              className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Add First Record
            </button>
          )}
        </div>
      )}
    </div>
  );

  // Main Layout
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}
      
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <header className="bg-white shadow-sm p-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-all"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-semibold text-gray-800">{currentUser.name}</p>
              <p className="text-sm text-gray-600">{currentUser.role}</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
              {currentUser.name.charAt(0)}
            </div>
          </div>
        </header>
        
        <main className="flex-1 p-8 overflow-auto">
          {currentView === 'dashboard' && <Dashboard />}
          {currentView === 'doctors' && <DoctorsList />}
          {currentView === 'create-doctor' && <CreateDoctorForm />}
          {currentView === 'patients' && <PatientsList />}
          {currentView === 'create-patient' && <CreatePatientForm />}
          {currentView === 'add-record' && <AddRecordForm />}
          {currentView === 'records' && <RecordsList />}
          {currentView === 'patient-records' && <RecordsList />}
        </main>
      </div>
    </div>
  );
};

export default AdminPortal;