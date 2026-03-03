import { useState } from 'react';
import { Save, Upload, Globe, Mail, BellRing, Lock, Users, Palette, Shield, MessageSquare } from 'lucide-react'; // Import MessageSquare
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import MyQAActivity from '../components/settings/MyQAActivity'; // Import MyQAActivity
import ChangePasswordForm from '../components/profile/ChangePasswordModal'; // Import ChangePasswordModal

const Settings = () => {
  const { user } = useDashboard();
  const [activeTab, setActiveTab] = useState('general');
  
  // Check if user is admin
  const isAdmin = user?.role === 'admin';
  const isStudent = user?.role === 'student';
  const isTeacher = user?.role === 'teacher';
  
  const tabs = [
    { id: 'general', label: 'General', icon: <Globe size={18} />, adminOnly: true },
    { id: 'appearance', label: 'Appearance', icon: <Palette size={18} />, adminOnly: false },
    { id: 'password', label: 'Change Password', icon: <Lock size={18} />, adminOnly: false },
    { id: 'notifications', label: 'Notifications', icon: <BellRing size={18} />, adminOnly: false },
    { id: 'security', label: 'Security', icon: <Lock size={18} />, adminOnly: true },
    { id: 'users', label: 'Users & Permissions', icon: <Users size={18} />, adminOnly: true },
    { id: 'qa-activity', label: 'My Q&A Activity', icon: <MessageSquare size={18} />, adminOnly: false, roles: ['student', 'teacher'] }, // New Q&A tab
  ];

  // Filter tabs based on user role
  const filteredTabs = tabs.filter(tab => {
    if (tab.adminOnly && !isAdmin) return false;
    if (tab.roles && user) {
      return tab.roles.includes(user.role);
    }
    return true;
  });

  // If not admin and trying to access admin-only tab, redirect to general
  if (!isAdmin && ['security', 'users'].includes(activeTab)) {
    setActiveTab('general');
  }
  // If not student/teacher and trying to access Q&A tab, redirect to general
  if (!isStudent && !isTeacher && activeTab === 'qa-activity') {
    setActiveTab('general');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">
          {isAdmin ? 'Administrator settings' : 'User preferences'}
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-1">
          <Card className="p-0">
            <ul className="py-2">
              {filteredTabs.map((tab) => (
                <li key={tab.id}>
                  <button
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left ${
                      activeTab === tab.id
                        ? 'bg-primary-900/40 text-primary-300 border-l-2 border-primary-500'
                        : 'text-gray-300 hover:bg-background-800 hover:text-white'
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.adminOnly && (
                      <Shield size={14} className="text-secondary-400 ml-auto" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        
        <div className="lg:col-span-4">
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'appearance' && <AppearanceSettings />}
          {activeTab === 'password' && (
            <Card title="Change Password" subtitle="Update your account password">
              <ChangePasswordForm />
            </Card>
          )}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'security' && isAdmin && <SecuritySettings />}
          {activeTab === 'users' && isAdmin && <UsersPermissionsSettings />}
          {activeTab === 'qa-activity' && (isStudent || isTeacher) && <MyQAActivity />} {/* Render MyQAActivity */}
        </div>
      </div>
    </div>
  );
};

const GeneralSettings = () => {
  return (
    <Card title="General Settings">
      <div className="space-y-6">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Site Name</label>
          <input
            type="text"
            defaultValue="Learning Management Portal"
            className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        <div>
          <label className="block text-sm text-gray-400 mb-1">Site Tagline</label>
          <input
            type="text"
            defaultValue="Empowering educators, inspiring students"
            className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        <div>
          <label className="block text-sm text-gray-400 mb-1">Contact Email</label>
          <div className="flex">
            <div className="flex-shrink-0 bg-background-700 flex items-center px-3 rounded-l">
              <Mail size={18} className="text-gray-400" />
            </div>
            <input
              type="email"
              defaultValue="admin@example.com"
              className="flex-1 bg-background-800 text-white rounded-r py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm text-gray-400 mb-3">Logo</label>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-primary-900 rounded flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-300">L</span>
            </div>
            
            <div className="flex-1">
              <div className="border-2 border-dashed border-background-600 rounded p-4 text-center">
                <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-400 mb-2">Drag and drop logo file or click to browse</p>
                <button className="text-sm bg-background-800 hover:bg-background-700 text-white py-1 px-3 rounded transition-colors">
                  Upload Logo
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Recommended: 200x200px, PNG or SVG format</p>
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-sm text-gray-400 mb-1">Timezone</label>
          <select className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="utc">UTC (Coordinated Universal Time)</option>
            <option value="est">EST (Eastern Standard Time)</option>
            <option value="cst">CST (Central Standard Time)</option>
            <option value="mst">MST (Mountain Standard Time)</option>
            <option value="pst">PST (Pacific Standard Time)</option>
          </select>
        </div>
        
        <div className="flex justify-end">
          <button className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded transition-colors">
            <Save size={18} />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </Card>
  );
};

const AppearanceSettings = () => {
  const { 
    theme, 
    setTheme, 
    primaryColor, 
    setPrimaryColor, 
    accentColor, 
    setAccentColor,
    fontFamily,
    setFontFamily
  } = useDashboard();

  // Android 16 / Material You inspired themes
  const themes = [
    { 
      id: 'dark', 
      name: 'Midnight', 
      description: 'Deep dark base',
      colors: ['#0d1117', '#1f2937', '#374151'],
      accent: '#6366f1'
    },
    { 
      id: 'light', 
      name: 'Daylight', 
      description: 'Clean bright mode',
      colors: ['#f9fafb', '#f3f4f6', '#e5e7eb'],
      accent: '#6366f1'
    },
    { 
      id: 'purple', 
      name: 'Aurora', 
      description: 'Indigo galaxy',
      colors: ['#1e1b4b', '#312e81', '#4c1d95'],
      accent: '#a78bfa'
    },
    { 
      id: 'pink', 
      name: 'Blossom', 
      description: 'Rose energy',
      colors: ['#831843', '#9d174d', '#be185d'],
      accent: '#f9a8d4'
    },
    { 
      id: 'ocean', 
      name: 'Ocean', 
      description: 'Deep sea calm',
      colors: ['#0c1a2e', '#0f2744', '#1e3a5f'],
      accent: '#38bdf8'
    },
    { 
      id: 'forest', 
      name: 'Forest', 
      description: 'Nature grounded',
      colors: ['#0a1f14', '#0f2d1e', '#14532d'],
      accent: '#4ade80'
    },
    { 
      id: 'sunset', 
      name: 'Sunset', 
      description: 'Warm horizon',
      colors: ['#1c0a00', '#431407', '#7c2d12'],
      accent: '#fb923c'
    },
    { 
      id: 'slate', 
      name: 'Graphite', 
      description: 'Minimal pro',
      colors: ['#0f172a', '#1e293b', '#334155'],
      accent: '#94a3b8'
    },
  ];

  // Synced color palettes - Android 16 Material You style
  const colorPalettes = [
    { 
      name: 'Violet Storm', 
      primary: '#7c3aed', 
      accent: '#06b6d4',
      preview: ['#7c3aed', '#5b21b6', '#06b6d4']
    },
    { 
      name: 'Ocean Breeze', 
      primary: '#0ea5e9', 
      accent: '#10b981',
      preview: ['#0ea5e9', '#0284c7', '#10b981']
    },
    { 
      name: 'Flame', 
      primary: '#ef4444', 
      accent: '#f97316',
      preview: ['#ef4444', '#dc2626', '#f97316']
    },
    { 
      name: 'Neon Mint', 
      primary: '#10b981', 
      accent: '#a78bfa',
      preview: ['#10b981', '#059669', '#a78bfa']
    },
    { 
      name: 'Golden Hour', 
      primary: '#f59e0b', 
      accent: '#ec4899',
      preview: ['#f59e0b', '#d97706', '#ec4899']
    },
    { 
      name: 'Rose Quartz', 
      primary: '#ec4899', 
      accent: '#8b5cf6',
      preview: ['#ec4899', '#db2777', '#8b5cf6']
    },
    { 
      name: 'Arctic', 
      primary: '#6366f1', 
      accent: '#22d3ee',
      preview: ['#6366f1', '#4f46e5', '#22d3ee']
    },
    { 
      name: 'Emerald City', 
      primary: '#059669', 
      accent: '#0ea5e9',
      preview: ['#059669', '#047857', '#0ea5e9']
    },
  ];

  // Rich font options with Google Fonts
  const fontOptions = [
    { value: 'Sora', label: 'Sora', description: 'Modern & geometric', category: 'Sans-serif' },
    { value: 'DM Sans', label: 'DM Sans', description: 'Clean & neutral', category: 'Sans-serif' },
    { value: 'Outfit', label: 'Outfit', description: 'Friendly & versatile', category: 'Sans-serif' },
    { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans', description: 'Contemporary', category: 'Sans-serif' },
    { value: 'Nunito', label: 'Nunito', description: 'Rounded & warm', category: 'Sans-serif' },
    { value: 'Raleway', label: 'Raleway', description: 'Elegant & refined', category: 'Display' },
    { value: 'Josefin Sans', label: 'Josefin Sans', description: 'Art deco flair', category: 'Display' },
    { value: 'Exo 2', label: 'Exo 2', description: 'Tech forward', category: 'Display' },
    { value: 'Fira Code', label: 'Fira Code', description: 'Monospace code', category: 'Monospace' },
    { value: 'JetBrains Mono', label: 'JetBrains Mono', description: 'Dev favorite', category: 'Monospace' },
  ];

  const isActivePalette = (palette: typeof colorPalettes[0]) => 
    palette.primary === primaryColor && palette.accent === accentColor;

  // Load Google Font dynamically when selected
  const handleFontChange = (font: string) => {
    setFontFamily(font);
    // Dynamically inject font link
    const fontName = font.replace(/ /g, '+');
    const linkId = `google-font-${fontName}`;
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@300;400;500;600;700&display=swap`;
      document.head.appendChild(link);
    }
    document.documentElement.style.setProperty('--font-sans', font);
    document.body.style.fontFamily = `'${font}', sans-serif`;
  };

  const handleSaveSettings = () => {
    alert('Appearance settings saved!');
  };
  
  return (
    <Card title="Appearance" subtitle="Android 16-inspired theming & personalization">
      <div className="space-y-8">

        {/* Theme Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">Visual Theme</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {themes.map((themeOption) => (
              <button
                key={themeOption.id}
                onClick={() => setTheme(themeOption.id)}
                className={`relative rounded-2xl overflow-hidden transition-all duration-200 focus:outline-none group ${
                  theme === themeOption.id 
                    ? 'ring-2 ring-offset-2 ring-offset-background-900 ring-primary-500 scale-105 shadow-xl' 
                    : 'ring-1 ring-background-600 hover:scale-102 hover:ring-primary-400/50'
                }`}
              >
                {/* Color preview */}
                <div className="h-14 w-full flex">
                  {themeOption.colors.map((color, idx) => (
                    <div key={idx} className="flex-1 h-full" style={{ backgroundColor: color }}></div>
                  ))}
                  {/* Accent dot */}
                  <div 
                    className="absolute bottom-2 right-2 w-3 h-3 rounded-full ring-1 ring-white/30"
                    style={{ backgroundColor: themeOption.accent }}
                  />
                </div>
                {/* Label */}
                <div className="px-2 py-1.5 bg-background-800/90">
                  <p className={`text-xs font-semibold ${theme === themeOption.id ? 'text-primary-300' : 'text-gray-200'}`}>
                    {themeOption.name}
                  </p>
                  <p className="text-[10px] text-gray-500">{themeOption.description}</p>
                </div>
                {theme === themeOption.id && (
                  <div className="absolute top-1.5 left-1.5 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                    <svg width="8" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Synced Color Palettes */}
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1 uppercase tracking-wider">Synced Color Palettes</label>
          <p className="text-xs text-gray-500 mb-4">One click syncs both primary & accent colors</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {colorPalettes.map((palette) => (
              <button
                key={palette.name}
                onClick={() => { setPrimaryColor(palette.primary); setAccentColor(palette.accent); }}
                className={`relative p-3 rounded-2xl transition-all duration-200 focus:outline-none text-left ${
                  isActivePalette(palette)
                    ? 'ring-2 ring-primary-500 ring-offset-1 ring-offset-background-900 bg-background-700 scale-105'
                    : 'bg-background-800 hover:bg-background-700 ring-1 ring-background-600'
                }`}
              >
                {/* Color swatches */}
                <div className="flex gap-1 mb-2">
                  {palette.preview.map((c, i) => (
                    <div key={i} className={`h-5 rounded-full ${i === 0 ? 'flex-1' : 'w-5'}`} style={{ backgroundColor: c }}/>
                  ))}
                </div>
                <p className="text-xs font-medium text-gray-200">{palette.name}</p>
                {isActivePalette(palette) && (
                  <div className="absolute top-2 right-2 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                    <svg width="8" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Color Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wider">Primary Color</label>
            <div className="flex items-center gap-3 bg-background-800 rounded-xl p-2 ring-1 ring-background-600">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-9 w-9 rounded-lg overflow-hidden bg-transparent border-0 cursor-pointer flex-shrink-0"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="flex-1 bg-transparent text-white text-sm focus:outline-none font-mono"
              />
              <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: primaryColor }} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wider">Accent Color</label>
            <div className="flex items-center gap-3 bg-background-800 rounded-xl p-2 ring-1 ring-background-600">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-9 w-9 rounded-lg overflow-hidden bg-transparent border-0 cursor-pointer flex-shrink-0"
              />
              <input
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="flex-1 bg-transparent text-white text-sm focus:outline-none font-mono"
              />
              <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
            </div>
          </div>
        </div>

        {/* Font Family */}
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1 uppercase tracking-wider">Typography</label>
          <p className="text-xs text-gray-500 mb-4">Choose a font that matches your style</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {fontOptions.map((font) => (
              <button
                key={font.value}
                onClick={() => handleFontChange(font.value)}
                className={`flex items-center justify-between p-3 rounded-xl transition-all text-left ${
                  fontFamily === font.value
                    ? 'bg-primary-900/40 ring-2 ring-primary-500 text-primary-200'
                    : 'bg-background-800 ring-1 ring-background-600 hover:bg-background-700 text-gray-300'
                }`}
              >
                <div>
                  <p className="text-sm font-medium" style={{ fontFamily: `'${font.value}', sans-serif` }}>{font.label}</p>
                  <p className="text-[11px] text-gray-500">{font.description}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  font.category === 'Monospace' ? 'bg-yellow-900/40 text-yellow-400' 
                  : font.category === 'Display' ? 'bg-purple-900/40 text-purple-400'
                  : 'bg-blue-900/40 text-blue-400'
                }`}>
                  {font.category}
                </span>
              </button>
            ))}
          </div>
          {/* Live preview */}
          <div className="mt-3 p-4 bg-background-800 rounded-xl ring-1 ring-background-600">
            <p className="text-xs text-gray-500 mb-2">Live Preview</p>
            <p className="text-lg font-bold text-white" style={{ fontFamily: `'${fontFamily}', sans-serif` }}>The quick brown fox</p>
            <p className="text-sm text-gray-400" style={{ fontFamily: `'${fontFamily}', sans-serif` }}>jumps over the lazy dog — 1234567890</p>
          </div>
        </div>

        {/* Animations Toggle */}
        <div className="flex items-center justify-between p-4 bg-background-800 rounded-xl ring-1 ring-background-600">
          <div>
            <p className="text-sm font-semibold text-white">Enable Animations</p>
            <p className="text-xs text-gray-500 mt-0.5">Smooth transitions & micro-interactions</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" defaultChecked className="sr-only peer" />
            <div className="w-11 h-6 bg-background-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
        </div>
        
        <div className="flex justify-end">
          <button 
            onClick={handleSaveSettings}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2.5 px-6 rounded-xl transition-colors font-medium"
          >
            <Save size={18} />
            <span>Save Appearance</span>
          </button>
        </div>
      </div>
    </Card>
  );
};

const NotificationSettings = () => {
  return (
    <Card title="Notification Settings">
      <div className="space-y-6">
        <div>
          <h3 className="text-white font-medium mb-3">Email Notifications</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>New user registrations</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>New content uploads</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Study plan updates</span>
              <input
                type="checkbox"
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>System alerts</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-medium mb-3">Dashboard Notifications</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>User activity updates</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Content engagement metrics</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Weekly summary reports</span>
              <input
                type="checkbox"
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-medium mb-3">Notification Frequency</h3>
          <select className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="immediate">Immediate</option>
            <option value="hourly">Hourly Digest</option>
            <option value="daily">Daily Digest</option>
            <option value="weekly">Weekly Digest</option>
          </select>
        </div>
        
        <div className="flex justify-end">
          <button className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded transition-colors">
            <Save size={18} />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </Card>
  );
};

const SecuritySettings = () => {
  return (
    <Card title="Security Settings" subtitle="Administrator access required">
      <div className="space-y-6">
        <div>
          <h3 className="text-white font-medium mb-3">Password Policy</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Require strong passwords (min. 8 characters with uppercase, number, symbol)</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Force password reset every 90 days</span>
              <input
                type="checkbox"
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Prevent password reuse (last 5 passwords)</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-medium mb-3">Two-Factor Authentication</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Require 2FA for admin accounts</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Allow SMS verification</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Allow authenticator apps</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-medium mb-3">Session Management</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Auto-logout after inactivity (minutes)</label>
              <input
                type="number"
                defaultValue="30"
                min="5"
                max="240"
                className="w-32 bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Allow multiple concurrent sessions</span>
              <input
                type="checkbox"
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-medium mb-3">Login Attempts</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Max failed login attempts before lockout</label>
              <input
                type="number"
                defaultValue="5"
                min="3"
                max="10"
                className="w-32 bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Account lockout duration (minutes)</label>
              <input
                type="number"
                defaultValue="15"
                min="5"
                max="60"
                className="w-32 bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded transition-colors">
            <Save size={18} />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </Card>
  );
};

const UsersPermissionsSettings = () => {
  const [requireApproval, setRequireApproval] = useState(true);

  return (
    <Card title="Users & Permissions Settings" subtitle="Administrator access required">
      <div className="space-y-6">
        <div>
          <h3 className="text-white font-medium mb-3">Role Management</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-background-800">
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Role</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Dashboard</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Users</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Content</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Study Plans</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Analytics</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Settings</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-background-800">
                  <td className="p-3 text-white">Admin</td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                </tr>
                <tr className="border-b border-background-800">
                  <td className="p-3 text-white">Teacher</td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                </tr>
                <tr className="border-b border-background-800">
                  <td className="p-3 text-white">Student</td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-medium mb-3">Custom Role</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Role Name</label>
              <input
                type="text"
                placeholder="E.g., Content Manager"
                className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Base Permissions On</label>
              <select className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Select a role</option>
                <option value="admin">Admin</option>
                <option value="teacher">Teacher</option>
                <option value="student">Student</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4">
            <button className="bg-primary-600 hover:bg-primary-700 text-white py-1.5 px-3 rounded text-sm transition-colors">
              Add Custom Role
            </button>
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-medium mb-3">Registration Settings</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Allow public registration</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Require email verification</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <div>
                <span>Require admin approval for new accounts</span>
                <p className="text-xs text-gray-400 mt-1">
                  When enabled, new user registrations will be pending until approved by an admin
                </p>
              </div>
              <input
                type="checkbox"
                checked={requireApproval}
                onChange={(e) => setRequireApproval(e.target.checked)}
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            {requireApproval && (
              <div className="ml-6 p-3 bg-primary-900/20 border border-primary-500/30 rounded-lg">
                <p className="text-sm text-primary-300 font-medium">Admin Approval Enabled</p>
                <p className="text-xs text-gray-400 mt-1">
                  New users will be created with "pending" status and cannot sign in until approved by an admin.
                  Admins will see pending users in the "Manage Users" section.
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex justify-end">
          <button className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded transition-colors">
            <Save size={18} />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </Card>
  );
};

export default Settings;
