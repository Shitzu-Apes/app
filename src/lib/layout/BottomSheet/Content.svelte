<div class="flex flex-col w-full h-full mx-auto justify-start items-center">
  <!-- heder slot -->
  <slot name="header" />
  <!-- Horizontal Line -->
  <hr class="w-full border-lime mt-3" />
  <div class="block w-full h-full">
    <slot />
  </div>
</div>
