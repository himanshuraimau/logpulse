import { create } from "zustand"

type DashboardState = {
  selectedService: string
  setSelectedService: (service: string) => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  selectedService: "all",
  setSelectedService: (service) => set({ selectedService: service }),
}))
