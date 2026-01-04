"use client"

import { Button } from "@/components/ui/button"
import { Star } from "lucide-react"

interface FilterBarProps {
  onFilterChange: (filterType: string, value: string | null) => void
}

export function FilterBar({ onFilterChange }: FilterBarProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap gap-4">
        {/* Star filters */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Stars:</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((stars) => (
              <Button
                key={stars}
                variant="outline"
                size="sm"
                onClick={() => onFilterChange('stars', stars.toString())}
                className="h-8"
              >
                {stars}
                <Star className="h-3 w-3 ml-1" />
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFilterChange('stars', null)}
              className="h-8"
            >
              Clear
            </Button>
          </div>
        </div>

        {/* Color filters */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Color:</span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onFilterChange('color', 'RED')}
              className="h-8 bg-red-50 hover:bg-red-100 text-red-700 border-red-300"
            >
              Red
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onFilterChange('color', 'YELLOW')}
              className="h-8 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-300"
            >
              Yellow
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onFilterChange('color', 'GREEN')}
              className="h-8 bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
            >
              Green
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFilterChange('color', null)}
              className="h-8"
            >
              Clear
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
