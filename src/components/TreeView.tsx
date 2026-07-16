import { useEffect, useMemo, useRef } from 'react'
import { hierarchy, tree } from 'd3-hierarchy'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import type { Person } from '../lib/types'

interface Datum {
  person: Person | null // null — виртуальный корень при нескольких корнях
  childCount: number
  hiddenChildren: boolean
  children: Datum[]
}

interface Props {
  persons: Person[]
  /* toggled: инверсия дефолтной видимости детей (дефолт: depth < maxDepth — развёрнут) */
  toggled: Set<number>
  onToggle: (id: number) => void
  maxDepth: number
  onSelect: (p: Person) => void
  focusId: number | null
  notVerifiedLabel: string
}

const W = 150
const H = 74

export default function TreeView({ persons, toggled, onToggle, maxDepth, onSelect, focusId, notVerifiedLabel }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const centeredOnce = useRef(false)

  const nodes = useMemo(() => {
    if (!persons.length) return []
    const ids = new Set(persons.map((p) => p.id))
    const byFather = new Map<number, Person[]>()
    for (const p of persons) {
      if (p.father_id != null && ids.has(p.father_id)) {
        const arr = byFather.get(p.father_id) ?? []
        arr.push(p)
        byFather.set(p.father_id, arr)
      }
    }
    const roots = persons.filter((p) => p.father_id == null || !ids.has(p.father_id))

    const build = (p: Person, depth: number): Datum => {
      const kids = byFather.get(p.id) ?? []
      const expanded = (depth < maxDepth) !== toggled.has(p.id)
      return {
        person: p,
        childCount: kids.length,
        hiddenChildren: kids.length > 0 && !expanded,
        children: expanded ? kids.map((c) => build(c, depth + 1)) : [],
      }
    }

    const rootDatum: Datum =
      roots.length === 1
        ? build(roots[0], 1)
        : { person: null, childCount: roots.length, hiddenChildren: false, children: roots.map((r) => build(r, 1)) }

    const root = hierarchy<Datum>(rootDatum)
    tree<Datum>().nodeSize([W + 24, H + 70])(root)
    return root.descendants()
  }, [persons, toggled, maxDepth])

  // зум/пан: мышь + touch (pinch) — d3-zoom обрабатывает и то и другое
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 3])
      .on('zoom', (e) => gRef.current?.setAttribute('transform', e.transform.toString()))
    select(svg).call(z).on('dblclick.zoom', null)
    zoomRef.current = z
  }, [])

  // первичное центрирование корня
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || centeredOnce.current || !nodes.length || !zoomRef.current) return
    centeredOnce.current = true
    const { width } = svg.getBoundingClientRect()
    select(svg).call(zoomRef.current.transform, zoomIdentity.translate(width / 2, 60))
  }, [nodes])

  // центрирование найденного узла
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || focusId == null || !zoomRef.current) return
    const node = nodes.find((n) => n.data.person?.id === focusId)
    if (!node) return
    const { width, height } = svg.getBoundingClientRect()
    select(svg).call(
      zoomRef.current.transform,
      zoomIdentity.translate(width / 2 - node.x!, height / 2.5 - node.y!),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, nodes])

  return (
    <svg ref={svgRef} className="w-full h-full touch-none cursor-grab select-none bg-stone-100">
      <g ref={gRef}>
        {nodes.map((n) =>
          n.parent && n.parent.data.person ? (
            <path
              key={`l${n.data.person!.id}`}
              d={`M${n.parent.x},${n.parent.y! + H / 2} C${n.parent.x},${(n.parent.y! + n.y!) / 2} ${n.x},${(n.parent.y! + n.y!) / 2} ${n.x},${n.y! - H / 2}`}
              fill="none"
              stroke="#d6d3d1"
              strokeWidth={1.5}
            />
          ) : null,
        )}
        {nodes.map((n) => {
          const p = n.data.person
          if (!p) return null
          return (
            <g key={p.id} transform={`translate(${n.x},${n.y})`}>
              <foreignObject x={-W / 2} y={-H / 2} width={W} height={H}>
                <div
                  onClick={() => onSelect(p)}
                  className={`h-full rounded-xl px-2 py-1.5 cursor-pointer bg-white shadow-sm flex flex-col justify-center text-center border ${
                    p.is_verified ? 'border-stone-300' : 'border-amber-500 border-dashed'
                  }`}
                  title={p.is_verified ? p.full_name : `${p.full_name} — ${notVerifiedLabel}`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    {p.photo_url && (
                      <img src={p.photo_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                    )}
                    <span className="text-[13px] font-medium leading-tight line-clamp-2">{p.full_name}</span>
                  </div>
                  <div className="text-[11px] text-stone-500 mt-0.5">
                    {p.birth_year ?? ''}
                    {(p.birth_year || p.death_year) && !p.is_alive ? ` – ${p.death_year ?? '?'}` : ''}
                  </div>
                </div>
              </foreignObject>
              {n.data.childCount > 0 && (
                <g
                  transform={`translate(0,${H / 2 + 14})`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggle(p.id)
                  }}
                  className="cursor-pointer"
                >
                  <circle r={11} fill={n.data.hiddenChildren ? '#b45309' : '#fff'} stroke="#b45309" />
                  <text
                    textAnchor="middle"
                    dy="4"
                    fontSize="11"
                    fill={n.data.hiddenChildren ? '#fff' : '#b45309'}
                  >
                    {n.data.hiddenChildren ? `+${n.data.childCount}` : '–'}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </g>
    </svg>
  )
}
