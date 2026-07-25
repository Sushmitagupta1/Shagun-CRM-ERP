import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopNav from './TopNav'

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-cream">
      <Sidebar />
      <div className="lg:ml-60">
        <TopNav />
        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
