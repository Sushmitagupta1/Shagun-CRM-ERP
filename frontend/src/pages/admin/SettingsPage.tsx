import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import PageHeader from '@/components/common/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { Building2, Bell, Shield, User, Save, Upload, Palette, Loader2 } from 'lucide-react'
import {
  getCompanySettings,
  updateCompanySettings,
  uploadCompanyLogo,
  LOGO_URL,
  type CompanySettings,
} from '@/api/settings'

const TABS = [
  { id: 'company', label: 'Company Profile', icon: Building2 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'account', label: 'My Account', icon: User },
]

export default function SettingsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('company')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [logoSrc, setLogoSrc] = useState('/shagun-logo.png')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [companyForm, setCompanyForm] = useState<CompanySettings>({
    id: 1,
    name: 'Shagun Caterers',
    email: 'catering@cafeuppercrust.com',
    phone: '+91 8980003121',
    gst: '24AEOFS0061F1Z7',
    address: 'Parshwanath Business Park, 100 Feet Rd, Satellite, Prahlad Nagar',
    logo_file_name: null,
    logo_path: null,
  })
  const [notifForm, setNotifForm] = useState({
    emailNotifications: true,
    desktopNotifications: true,
    dailyDigest: false,
    followUpReminders: true,
    eventAlerts: true,
    paymentAlerts: true,
  })
  const [sessionTimeout, setSessionTimeout] = useState(15)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await getCompanySettings()
        setCompanyForm(data)
        if (data.notifications) {
          setNotifForm((prev) => ({ ...prev, ...data.notifications! }))
        }
        if (data.session_timeout_minutes) {
          setSessionTimeout(data.session_timeout_minutes)
        }
        setLogoSrc(data.logo_file_name ? `${LOGO_URL}?t=${Date.now()}` : '/shagun-logo.png')
      } catch {
        toast.error('Failed to load company settings')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = await updateCompanySettings({
        name: companyForm.name,
        email: companyForm.email,
        phone: companyForm.phone,
        gst: companyForm.gst,
        address: companyForm.address,
        notifications: notifForm,
        session_timeout_minutes: sessionTimeout,
      })
      setCompanyForm(data)
      if (data.notifications) {
        setNotifForm((prev) => ({ ...prev, ...data.notifications! }))
      }
      if (data.session_timeout_minutes) {
        setSessionTimeout(data.session_timeout_minutes)
      }
      toast.success('Settings saved successfully')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoSelect = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const data = await uploadCompanyLogo(file)
      setCompanyForm(data)
      setLogoSrc(`${LOGO_URL}?t=${Date.now()}`)
      toast.success('Logo updated successfully')
    } catch {
      toast.error('Failed to upload logo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Manage your ERP configuration"
        action={
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-gold-hover disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Changes
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Tab List */}
        <div className="space-y-1">
          {TABS.map((tab) => (
            <motion.button
              key={tab.id}
              whileHover={{ x: 4 }}
              onClick={() => setActiveTab(tab.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-maroon text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </motion.button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="lg:col-span-3 space-y-4">
          {activeTab === 'company' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-white p-6 shadow-md space-y-4"
            >
              <h3 className="text-sm font-semibold text-slate-700">Company Information</h3>
              {loading ? (
                <div className="flex items-center justify-center py-10 text-slate-400">
                  <Loader2 size={20} className="mr-2 animate-spin" /> Loading settings...
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Company Name</label>
                    <input
                      value={companyForm.name}
                      onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-maroon focus:outline-none focus:ring-1 focus:ring-maroon"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
                    <input
                      value={companyForm.email}
                      onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-maroon focus:outline-none focus:ring-1 focus:ring-maroon"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Phone</label>
                    <input
                      value={companyForm.phone}
                      onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-maroon focus:outline-none focus:ring-1 focus:ring-maroon"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">GST Number</label>
                    <input
                      value={companyForm.gst}
                      onChange={(e) => setCompanyForm({ ...companyForm, gst: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-maroon focus:outline-none focus:ring-1 focus:ring-maroon"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-500">Address</label>
                    <input
                      value={companyForm.address}
                      onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-maroon focus:outline-none focus:ring-1 focus:ring-maroon"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Company Logo</label>
                <div className="flex items-center gap-4">
                  <img
                    src={logoSrc}
                    alt="Logo"
                    onError={(e) => {
                      if ((e.currentTarget.src !== '/shagun-logo.png')) {
                        e.currentTarget.src = '/shagun-logo.png'
                      }
                    }}
                    className="h-12 w-auto rounded-lg border border-slate-200 object-contain bg-white"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                    className="hidden"
                    onChange={(e) => handleLogoSelect(e.target.files?.[0])}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploading ? 'Uploading...' : 'Change Logo'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'notifications' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-white p-6 shadow-md space-y-4"
            >
              <h3 className="text-sm font-semibold text-slate-700">Notification Preferences</h3>
              {Object.entries({
                emailNotifications: 'Email Notifications',
                desktopNotifications: 'Desktop Notifications',
                dailyDigest: 'Daily Digest Email',
                followUpReminders: 'Follow-up Reminders',
                eventAlerts: 'Event Day Alerts',
                paymentAlerts: 'Payment Due Alerts',
              }).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                  <button
                    onClick={() =>
                      setNotifForm({ ...notifForm, [key]: !notifForm[key as keyof typeof notifForm] })
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      notifForm[key as keyof typeof notifForm] ? 'bg-maroon' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        notifForm[key as keyof typeof notifForm] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </label>
              ))}
            </motion.div>
          )}

          {activeTab === 'appearance' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-white p-6 shadow-md space-y-4"
            >
              <h3 className="text-sm font-semibold text-slate-700">Appearance</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border-2 border-maroon p-4 text-center">
                  <div className="mx-auto mb-2 h-10 w-20 rounded-lg bg-gradient-to-b from-maroon to-maroon-dark" />
                  <p className="text-xs font-semibold text-maroon">Maroon (Default)</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4 text-center opacity-50">
                  <div className="mx-auto mb-2 h-10 w-20 rounded-lg bg-gradient-to-b from-slate-700 to-slate-900" />
                  <p className="text-xs font-medium text-slate-500">Dark (Coming Soon)</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">Theme customization coming in future updates.</p>
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-white p-6 shadow-md space-y-4"
            >
              <h3 className="text-sm font-semibold text-slate-700">Security</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Two-Factor Authentication</p>
                    <p className="text-xs text-slate-400">Add an extra layer of security</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">Coming Soon</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Session Timeout</p>
                    <p className="text-xs text-slate-400">Auto-logout after inactivity</p>
                  </div>
                  <select
                    value={sessionTimeout}
                    onChange={(e) => setSessionTimeout(Number(e.target.value))}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                  </select>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Password Policy</p>
                    <p className="text-xs text-slate-400">Minimum 8 characters, 1 uppercase, 1 number</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">Active</span>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'account' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-white p-6 shadow-md space-y-4"
            >
              <h3 className="text-sm font-semibold text-slate-700">My Account</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Full Name</label>
                  <input
                    defaultValue={user?.full_name}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-maroon focus:outline-none focus:ring-1 focus:ring-maroon"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
                  <input
                    defaultValue={user?.email}
                    disabled
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">New Password</label>
                  <input
                    type="password"
                    placeholder="Leave blank to keep current"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-maroon focus:outline-none focus:ring-1 focus:ring-maroon"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Role</label>
                  <input
                    value={user?.role.name ?? ''}
                    disabled
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
