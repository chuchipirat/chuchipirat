/**
 * Wiederverwendbarer Rich-Text-Editor basierend auf TipTap (ProseMirror).
 *
 * Ersetzt den bisherigen ReactQuill-Editor und bietet eine Material-UI-
 * kompatible Toolbar mit Formatierungs-Optionen.
 *
 * @example
 * <RichTextEditor
 *   value="<p>Hallo Welt</p>"
 *   onChange={(html) => console.log(html)}
 * />
 */
import React from "react";
import {useEditor, EditorContent} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
  Box,
  IconButton,
  Divider,
  Tooltip,
  useTheme,
} from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import StrikethroughSIcon from "@mui/icons-material/StrikethroughS";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import CodeIcon from "@mui/icons-material/Code";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";

/**
 * Props für den RichTextEditor.
 *
 * @param value HTML-String als Initialwert / kontrollierter Wert.
 * @param onChange Callback bei Inhaltsänderung, liefert den HTML-String.
 * @param style Optionale CSS-Styles für den äusseren Container.
 */
type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  style?: React.CSSProperties;
};

/**
 * Rich-Text-Editor mit Material-UI-Toolbar.
 *
 * Nutzt TipTap mit StarterKit (Fett, Kursiv, Durchgestrichen, Überschriften,
 * Aufzählungen, Blockquote, Code, Trennlinie) und Link-Erweiterung.
 *
 * @param value HTML-Inhalt des Editors.
 * @param onChange Callback bei jeder Inhaltsänderung.
 * @param style Optionale CSS-Styles für den Container.
 */
export const RichTextEditor = ({value, onChange, style}: RichTextEditorProps) => {
  const theme = useTheme();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
        },
      }),
    ],
    content: value,
    onUpdate: ({editor: updatedEditor}) => {
      onChange(updatedEditor.getHTML());
    },
  });

  // Kontrollierter Wert: Externen Wert synchronisieren, falls er sich ändert
  React.useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, {emitUpdate: false});
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  /**
   * Öffnet einen Dialog zur Eingabe einer URL und setzt den Link im Editor.
   */
  const handleSetLink = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL eingeben:", previousUrl ?? "https://");

    if (url === null) return; // Abgebrochen

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({href: url})
      .run();
  };

  return (
    <Box
      sx={{
        border: 1,
        borderColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.23)" : "rgba(0,0,0,0.23)",
        borderRadius: 1,
        "&:focus-within": {
          borderColor: theme.palette.primary.main,
          borderWidth: 2,
        },
        ...style,
      }}
    >
      {/* Toolbar */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 0.25,
          px: 0.5,
          py: 0.25,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Tooltip title="Fett">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().toggleBold().run()}
            color={editor.isActive("bold") ? "primary" : "default"}
          >
            <FormatBoldIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Kursiv">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            color={editor.isActive("italic") ? "primary" : "default"}
          >
            <FormatItalicIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Durchgestrichen">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            color={editor.isActive("strike") ? "primary" : "default"}
          >
            <StrikethroughSIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{mx: 0.5}} />

        <Tooltip title="Aufzählung">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            color={editor.isActive("bulletList") ? "primary" : "default"}
          >
            <FormatListBulletedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Nummerierte Liste">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            color={editor.isActive("orderedList") ? "primary" : "default"}
          >
            <FormatListNumberedIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{mx: 0.5}} />

        <Tooltip title="Zitat">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            color={editor.isActive("blockquote") ? "primary" : "default"}
          >
            <FormatQuoteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Code">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().toggleCode().run()}
            color={editor.isActive("code") ? "primary" : "default"}
          >
            <CodeIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Trennlinie">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            <HorizontalRuleIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{mx: 0.5}} />

        <Tooltip title="Link setzen">
          <IconButton
            size="small"
            onClick={handleSetLink}
            color={editor.isActive("link") ? "primary" : "default"}
          >
            <LinkIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Link entfernen">
          <IconButton
            size="small"
            onClick={() => editor.chain().focus().unsetLink().run()}
            disabled={!editor.isActive("link")}
          >
            <LinkOffIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Editor-Bereich */}
      <Box
        sx={{
          "& .tiptap": {
            minHeight: 150,
            px: 1.5,
            py: 1,
            outline: "none",
            "& p": {margin: "0.25em 0"},
          },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
};
