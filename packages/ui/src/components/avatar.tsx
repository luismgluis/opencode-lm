import { type ComponentProps, splitProps, Show } from "solid-js"

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : undefined

function chars(value: string, count: number) {
  if (!value) return ""
  if (!segmenter) return Array.from(value).slice(0, count).join("") ?? ""
  const result: string[] = []
  for (const seg of segmenter.segment(value)) {
    if (result.length >= count) break
    result.push(seg.segment)
  }
  return result.join("")
}

export interface AvatarProps extends ComponentProps<"div"> {
  fallback: string
  src?: string
  background?: string
  foreground?: string
  background2?: string
  size?: "small" | "normal" | "large"
}

export function Avatar(props: AvatarProps) {
  const [split, rest] = splitProps(props, [
    "fallback",
    "src",
    "background",
    "foreground",
    "background2",
    "size",
    "class",
    "classList",
    "style",
  ])
  const src = split.src
  const isDual = () => !src && split.background && split.background2
  return (
    <div
      {...rest}
      data-component="avatar"
      data-size={split.size || "normal"}
      data-has-image={src ? "" : undefined}
      data-dual={isDual() ? "" : undefined}
      classList={{
        ...split.classList,
        [split.class ?? ""]: !!split.class,
      }}
      style={{
        ...(typeof split.style === "object" ? split.style : {}),
        ...(!src && split.background ? { "--avatar-bg": split.background } : {}),
        ...(!src && split.foreground ? { "--avatar-fg": split.foreground } : {}),
        ...(!src && split.background2 ? { "--avatar-bg2": split.background2 } : {}),
      }}
    >
      <Show when={src} fallback={chars(split.fallback, isDual() ? 2 : 1)}>
        {(src) => <img src={src()} draggable={false} data-slot="avatar-image" />}
      </Show>
    </div>
  )
}
