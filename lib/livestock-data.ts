export interface LivestockAnimal {
  id: string
  name: string
  type: 'cow' | 'sheep' | 'goat' | 'pig'
  age: number
  weight: number
  healthStatus: 'healthy' | 'warning' | 'critical'
  heartRate: number
  pulse: number
  temperature: number
  oxygenLevel: number
  digestScore: number
  lastCheckup: string
  location: string
}

export const livestockData: LivestockAnimal[] = [
  {
    id: 'COW-001',
    name: 'Bessie',
    type: 'cow',
    age: 5,
    weight: 650,
    healthStatus: 'healthy',
    heartRate: 68,
    pulse: 70,
    temperature: 38.2,
    oxygenLevel: 98,
    digestScore: 92,
    lastCheckup: '2024-08-02',
    location: 'Pasture A',
  },
  {
    id: 'COW-002',
    name: 'Daisy',
    type: 'cow',
    age: 4,
    weight: 620,
    healthStatus: 'warning',
    heartRate: 85,
    pulse: 88,
    temperature: 39.1,
    oxygenLevel: 95,
    digestScore: 78,
    lastCheckup: '2024-08-01',
    location: 'Barn B',
  },
  {
    id: 'COW-003',
    name: 'Molly',
    type: 'cow',
    age: 3,
    weight: 580,
    healthStatus: 'healthy',
    heartRate: 72,
    pulse: 74,
    temperature: 38.3,
    oxygenLevel: 97,
    digestScore: 88,
    lastCheckup: '2024-08-03',
    location: 'Pasture C',
  },
  {
    id: 'COW-004',
    name: 'Clara',
    type: 'cow',
    age: 6,
    weight: 680,
    healthStatus: 'critical',
    heartRate: 102,
    pulse: 105,
    temperature: 39.8,
    oxygenLevel: 92,
    digestScore: 65,
    lastCheckup: '2024-08-02',
    location: 'Isolation Pen',
  },
  {
    id: 'COW-005',
    name: 'Rosie',
    type: 'cow',
    age: 2,
    weight: 550,
    healthStatus: 'healthy',
    heartRate: 70,
    pulse: 72,
    temperature: 38.1,
    oxygenLevel: 99,
    digestScore: 95,
    lastCheckup: '2024-08-03',
    location: 'Pasture A',
  },
  {
    id: 'COW-006',
    name: 'Buttercup',
    type: 'cow',
    age: 4,
    weight: 610,
    healthStatus: 'warning',
    heartRate: 80,
    pulse: 82,
    temperature: 38.9,
    oxygenLevel: 94,
    digestScore: 75,
    lastCheckup: '2024-08-02',
    location: 'Pasture B',
  },
  {
    id: 'SHEEP-001',
    name: 'Woolly',
    type: 'sheep',
    age: 3,
    weight: 85,
    healthStatus: 'healthy',
    heartRate: 90,
    pulse: 92,
    temperature: 39.0,
    oxygenLevel: 96,
    digestScore: 85,
    lastCheckup: '2024-08-03',
    location: 'Pasture D',
  },
  {
    id: 'SHEEP-002',
    name: 'Fluffy',
    type: 'sheep',
    age: 2,
    weight: 78,
    healthStatus: 'healthy',
    heartRate: 88,
    pulse: 90,
    temperature: 39.1,
    oxygenLevel: 97,
    digestScore: 88,
    lastCheckup: '2024-08-03',
    location: 'Pasture D',
  },
]

export function getHealthMetrics() {
  const total = livestockData.length
  const healthy = livestockData.filter((a) => a.healthStatus === 'healthy').length
  const warning = livestockData.filter((a) => a.healthStatus === 'warning').length
  const critical = livestockData.filter((a) => a.healthStatus === 'critical').length

  const avgHeartRate =
    livestockData.reduce((sum, a) => sum + a.heartRate, 0) / total
  const avgTemp = livestockData.reduce((sum, a) => sum + a.temperature, 0) / total
  const avgOxygen =
    livestockData.reduce((sum, a) => sum + a.oxygenLevel, 0) / total

  return {
    total,
    healthy,
    warning,
    critical,
    avgHeartRate: Math.round(avgHeartRate),
    avgTemp: avgTemp.toFixed(1),
    avgOxygen: Math.round(avgOxygen),
  }
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'healthy':
      return 'bg-green-500'
    case 'warning':
      return 'bg-yellow-500'
    case 'critical':
      return 'bg-red-500'
    default:
      return 'bg-gray-500'
  }
}

export function getStatusTextColor(status: string) {
  switch (status) {
    case 'healthy':
      return 'text-green-700'
    case 'warning':
      return 'text-yellow-700'
    case 'critical':
      return 'text-red-700'
    default:
      return 'text-gray-700'
  }
}
