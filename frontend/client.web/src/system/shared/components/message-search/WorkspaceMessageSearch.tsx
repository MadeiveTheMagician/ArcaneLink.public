import type { ReactNode } from 'react'
import type { ComponentProps } from 'react'
import { MobileMessageSearch } from '../../../Mobile/components/MobileMessageSearch'
import { MessageSearchControl } from './MessageSearchControl'
import { MessageSearchResults } from './MessageSearchResults'
import styles from './WorkspaceMessageSearch.module.css'

type Props = {
  control: ComponentProps<typeof MessageSearchControl>
  results?: ComponentProps<typeof MessageSearchResults>
  actions?: ReactNode
}

export function WorkspaceMessageSearch({ control, results, actions }: Props) {
  return (
    <div className={styles.bar}>
      <div className={styles.field}>
        <MessageSearchControl {...control} />
        {results && (
          <div className={styles.results}>
            <MessageSearchResults {...results} />
          </div>
        )}
      </div>
      <MobileMessageSearch control={control} results={results} />
      {actions}
    </div>
  )
}
