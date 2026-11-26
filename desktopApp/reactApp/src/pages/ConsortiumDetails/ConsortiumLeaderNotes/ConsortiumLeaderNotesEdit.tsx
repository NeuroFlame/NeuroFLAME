import { Box, Button, useTheme } from '@mui/material'
import { useState } from 'react'
import {
  MDXEditor,
  BoldItalicUnderlineToggles,
  ListsToggle,
  headingsPlugin,
  quotePlugin,
  listsPlugin,
  toolbarPlugin,
  diffSourcePlugin,
  DiffSourceToggleWrapper,
  markdownShortcutPlugin,
  linkPlugin,
} from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'

interface ConsortiumLeaderNotesEditProps {
  consortiumLeaderNotes: string;
  onSave: (newNotes: string) => void;
  onCancel: () => void;
}

export default function ConsortiumLeaderNotesEdit({
  consortiumLeaderNotes,
  onSave,
  onCancel,
}: ConsortiumLeaderNotesEditProps) {
  const theme = useTheme()
  const [notes, setNotes] = useState(consortiumLeaderNotes)

  const handleSave = () => {
    onSave(notes)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 1 }}>
        <Button
          variant='outlined'
          color='secondary'
          size='small'
          onClick={onCancel}
          sx={{ mr: 1 }}
        >
          Cancel
        </Button>
        <Button
          variant='contained'
          color='primary'
          size='small'
          onClick={handleSave}
        >
          Save
        </Button>
      </Box>
      <MDXEditor
        className={theme.palette.mode === 'dark' ? 'dark-theme dark-editor' : ''}
        markdown={notes}
        onChange={(e) => setNotes(e)}
        plugins={[
          headingsPlugin(),
          quotePlugin(),
          linkPlugin(),
          listsPlugin(),
          toolbarPlugin({
            toolbarClassName: 'my-classname',
            toolbarContents: () => (
              <>
                {' '}
                <DiffSourceToggleWrapper options={['rich-text', 'source']}>
                  <BoldItalicUnderlineToggles />
                  <ListsToggle />
                </DiffSourceToggleWrapper>
              </>
            ),
          }),
          diffSourcePlugin({ diffMarkdown: notes, viewMode: 'rich-text' }),
          markdownShortcutPlugin(),
        ]}
      />
    </Box>
  )
}
