'use client'

import type { Table } from '@tanstack/react-table'
import type { ReactNode } from 'react'
import { XIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { DataTableViewOptions } from './DataTableViewOptions'

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  search: string
  onSearchChange: (search: string) => void
  searchPlaceholder?: string
  enableColumnVisibility?: boolean
  enableSelection?: boolean
  leftContent?: ReactNode
  rightContent?: ReactNode
  searchInputClassName?: string
  searchLeadingIcon?: ReactNode
}

function DataTableToolbarInner<TData>({
  table,
  search,
  onSearchChange,
  searchPlaceholder,
  enableColumnVisibility = true,
  enableSelection = false,
  leftContent,
  rightContent,
  searchInputClassName,
  searchLeadingIcon,
}: DataTableToolbarProps<TData>) {
  const t = useExtracted()
  const [searchInput, setSearchInput] = useState(search)
  const debounceTimeoutRef = useRef<number | null>(null)
  const lastSubmittedSearchRef = useRef(search)
  const searchRef = useRef(search)
  searchRef.current = search

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current !== null) {
        window.clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  function handleSearchInputChange(nextSearch: string) {
    setSearchInput(nextSearch)

    if (debounceTimeoutRef.current !== null) {
      window.clearTimeout(debounceTimeoutRef.current)
      debounceTimeoutRef.current = null
    }

    if (nextSearch === search) {
      return
    }

    lastSubmittedSearchRef.current = searchRef.current

    debounceTimeoutRef.current = window.setTimeout(() => {
      const hasExternalSearchOverride = searchRef.current !== lastSubmittedSearchRef.current
      if (hasExternalSearchOverride) {
        debounceTimeoutRef.current = null
        return
      }

      lastSubmittedSearchRef.current = nextSearch
      onSearchChange(nextSearch)
      debounceTimeoutRef.current = null
    }, 300)
  }

  const resolvedSearchPlaceholder = searchPlaceholder ?? t('Search...')
  const showPendingSearchInput
    = debounceTimeoutRef.current !== null
      && search === lastSubmittedSearchRef.current
  const resolvedSearchInput = showPendingSearchInput ? searchInput : search
  const isFiltered = resolvedSearchInput.length > 0
  const selectedRowsCount = table.getFilteredSelectedRowModel().rows.length
  const selectionSummary = enableSelection && selectedRowsCount > 0
    ? (
        <div className="text-sm text-muted-foreground">
          {t('{selected} of {total} row(s) selected.', {
            selected: String(selectedRowsCount),
            total: String(table.getFilteredRowModel().rows.length),
          })}
        </div>
      )
    : null
  const resetButton = isFiltered
    ? (
        <Button
          variant="ghost"
          onClick={() => {
            if (debounceTimeoutRef.current !== null) {
              window.clearTimeout(debounceTimeoutRef.current)
              debounceTimeoutRef.current = null
            }
            lastSubmittedSearchRef.current = ''
            setSearchInput('')
            onSearchChange('')
          }}
          className="h-9 px-2 lg:px-3"
        >
          {t('Reset')}
          <XIcon className="ml-2 size-4" />
        </Button>
      )
    : null
  const trailingControls = (
    <>
      {selectionSummary}
      {rightContent}
      {enableColumnVisibility && <DataTableViewOptions table={table} />}
    </>
  )
  const hasToolbarControls = Boolean(leftContent)
    || Boolean(resetButton)
    || Boolean(selectionSummary)
    || Boolean(rightContent)
    || enableColumnVisibility

  return (
    <div className="space-y-2 sm:space-y-0">
      <div className="sm:hidden">
        <div className="relative w-full">
          {searchLeadingIcon && (
            <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground">
              {searchLeadingIcon}
            </span>
          )}
          <Input
            placeholder={resolvedSearchPlaceholder}
            value={resolvedSearchInput}
            onChange={event => handleSearchInputChange(event.target.value)}
            className={cn(
              'h-8 w-full',
              searchLeadingIcon && 'pl-8',
              searchInputClassName,
            )}
          />
        </div>
      </div>

      {hasToolbarControls && (
        <div className="flex flex-wrap items-center gap-2 sm:hidden">
          {leftContent}
          {resetButton}
          {trailingControls}
        </div>
      )}

      <div className="hidden items-center justify-between gap-2 sm:flex">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative">
            {searchLeadingIcon && (
              <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground">
                {searchLeadingIcon}
              </span>
            )}
            <Input
              placeholder={resolvedSearchPlaceholder}
              value={resolvedSearchInput}
              onChange={event => handleSearchInputChange(event.target.value)}
              className={cn(
                'h-8 w-full sm:w-37.5 lg:w-62.5',
                searchLeadingIcon && 'pl-8',
                searchInputClassName,
              )}
            />
          </div>
          {leftContent}
          {resetButton}
        </div>

        <div className="flex items-center gap-2">
          {trailingControls}
        </div>
      </div>
    </div>
  )
}

export function DataTableToolbar<TData>(props: DataTableToolbarProps<TData>) {
  return <DataTableToolbarInner {...props} />
}
