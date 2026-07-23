<script>
  export let size = undefined;
  export let color = '#000000';
  export let strokeWidth = 0.1;
  export let background = 'transparent';
  export let opacity = 1;
  export let rotation = 0;
  export let shadow = 0;
  export let flipHorizontal = false;
  export let flipVertical = false;
  export let padding = 0;

  $: transforms = [
    rotation !== 0 ? `rotate(${rotation}deg)` : '',
    flipHorizontal ? 'scaleX(-1)' : '',
    flipVertical ? 'scaleY(-1)' : ''
  ].filter(Boolean).join(' ');

  $: viewBoxSize = 24 + (padding * 2);
  $: viewBoxOffset = -padding;
  $: viewBox = `${viewBoxOffset} ${viewBoxOffset} ${viewBoxSize} ${viewBoxSize}`;
  $: bgColor = background !== 'transparent' ? background : undefined;
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox={viewBox}
  fill="none"
  stroke={color}
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  style="opacity: {opacity}; transform: {transforms}; {shadow > 0 ? `filter: drop-shadow(0 ${shadow}px ${shadow * 2}px rgba(0,0,0,0.3))` : ''}; {bgColor ? `background-color: ${bgColor}` : ''}"
>
  <path fill="currentColor" d="M17 22v-3h-3v-2h3v-3h2v3h3v2h-3v3zM5 20q-.825 0-1.412-.587T3 18V6q0-.825.588-1.412T5 4h1V2h2v2h6V2h2v2h1q.825 0 1.413.588T19 6v6.1q-.5-.075-1-.075t-1 .075V10H5v8h7q0 .5.075 1t.275 1zM5 8h12V6H5zm0 0V6z"/>
</svg>