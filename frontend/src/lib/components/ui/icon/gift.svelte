<script>
  export let size = undefined;
  export let color = '#000000';
  export let strokeWidth = 2;
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
  <path fill="none" stroke="currentColor" stroke-width={strokeWidth} d="M3 11h18v12H3zm-1 0V7h20v4zm10 12V7zM7 7h5s-2-5-5-5C3.5 2 3 7 7 7Zm10.184 0h-5s1.816-5 5-5c3.316 0 4 5 0 5Z"/>
</svg>