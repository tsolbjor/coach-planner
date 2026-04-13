import { createHashRouter, RouterProvider } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { SetupPage } from './pages/SetupPage'
import { RosterPage } from './pages/RosterPage'
import { PlannerPage } from './pages/PlannerPage'
import { PlanViewPage } from './pages/PlanViewPage'

const router = createHashRouter([
  { path: '/',        element: <HomePage /> },
  { path: '/setup',   element: <SetupPage /> },
  { path: '/roster',  element: <RosterPage /> },
  { path: '/planner', element: <PlannerPage /> },
  { path: '/plan',    element: <PlanViewPage /> },
])

export function App() {
  return <RouterProvider router={router} />
}
