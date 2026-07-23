<script>
  export let size = undefined;
  export let color = '#ffffff';
  export let strokeWidth = 0.5;
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
  <path fill="currentColor" d="M16.175 13H4v-2h12.175l-5.6-5.6L12 4l8 8l-8 8l-1.425-1.4z"/>
</svg>