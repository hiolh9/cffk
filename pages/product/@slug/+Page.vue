<template>
  <main class="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
    <header class="fixed inset-x-0 top-0 z-50 border-b bg-background">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <StorefrontBrand />
        <PublicNav />
      </div>
    </header>
    <div class="mt-14 flex min-h-0 flex-1 flex-col overflow-y-auto sm:mt-16">
      <section class="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-x-8 gap-y-6 px-4 pb-10 pt-5 sm:px-6 sm:pt-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[auto_1fr]">
        <div class="min-w-0 lg:col-start-1 lg:row-start-1">
          <div class="overflow-hidden rounded-md border bg-muted">
            <img :src="data.coverImage || defaultProductImage" :alt="data.name" class="aspect-4/3 max-h-[26rem] w-full object-cover sm:aspect-video" />
          </div>
          <div class="mt-5">
            <Badge variant="secondary" class="rounded px-2 py-0.5 text-xs font-medium shadow-none">{{ data.categoryName || messages.productCheckout.defaultCategory }}</Badge>
            <h1 class="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{{ data.name }}</h1>
            <p v-if="data.subtitle" class="mt-2 text-sm leading-6 text-muted-foreground">{{ data.subtitle }}</p>
          </div>
        </div>
        <aside class="min-w-0 self-start lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <Card class="gap-5 rounded-md py-5 shadow-none">
            <CardHeader class="gap-1 px-5">
              <CardDescription>{{ messages.productCheckout.currentPrice }}</CardDescription>
              <CardTitle class="text-3xl font-bold tabular-nums text-brand">RM{{ selectedSku.price }}</CardTitle>
            </CardHeader>
            <form class="grid min-w-0 gap-5" novalidate @submit.prevent="submit">
              <CardContent class="grid min-w-0 gap-5 px-5">
                <div v-if="data.skus.length > 1" class="grid gap-2 text-sm font-medium">
                  <span>选择规格</span>
                  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1" role="group" aria-label="选择规格">
                    <Button v-for="sku in data.skus" :key="sku.id" type="button" :variant="String(sku.id) === selectedSkuId ? 'default' : 'outline'" class="h-auto min-h-11 justify-start whitespace-normal rounded-md px-3 py-2 text-left text-sm leading-5 shadow-none" :aria-pressed="String(sku.id) === selectedSkuId" @click="selectedSkuId = String(sku.id)">
                      {{ sku.name }} · RM{{ sku.price }}
                    </Button>
                  </div>
                </div>
                <p v-if="requiresPayment && !methods.length" class="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{{ messages.productCheckout.noPaymentMethod }}</p>
                <label class="grid min-w-0 gap-2 text-sm font-medium">
                  <span class="flex items-center gap-1"><span class="text-destructive">*</span> {{ messages.productCheckout.contactEmail }}</span>
                  <Input v-model="contactValue" type="email" inputmode="email" autocomplete="email" required class="h-11 shadow-none" />
                </label>
                <label class="grid min-w-0 gap-2 text-sm font-medium">
                  <span class="flex items-center gap-1"><span class="text-destructive">*</span> {{ messages.productCheckout.quantity }}</span>
                  <Input v-model.number="quantity" type="number" inputmode="numeric" :min="selectedSku.minBuy" :max="purchaseLimit" required class="h-11 shadow-none" />
                  <span v-if="isStockLimited" class="text-xs font-normal text-muted-foreground">{{ t(messages.productCheckout.availableStock, { count: availableStock }) }}</span>
                </label>
                <FieldSet v-if="selectedSku.deliveryType === 'EXPRESS'" class="min-w-0 gap-4 rounded-md border bg-muted/40 p-4">
                  <FieldLegend>{{ messages.productCheckout.shippingAddress }}</FieldLegend>
                  <Field v-if="addresses.length" class="min-w-0">
                    <FieldLabel for="checkout-address">{{ messages.productCheckout.selectSavedAddress }}</FieldLabel>
                    <Select :model-value="selectedAddress" class="block w-full min-w-0" @update:model-value="onAddressSelectionChange">
                      <SelectTrigger id="checkout-address" class="h-11 w-full! min-w-0 max-w-full bg-background shadow-none **:data-[slot=select-value]:min-w-0 **:data-[slot=select-value]:flex-1 **:data-[slot=select-value]:truncate">
                        <SelectValue :placeholder="messages.productCheckout.selectShippingAddress" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="item in addresses" :key="String(item.id)" :value="String(item.id)">{{ item.recipientName }} · {{ item.phone }} · {{ addressSummary(item) }}</SelectItem>
                        <SelectItem value="new">{{ messages.productCheckout.enterNewAddress }}</SelectItem>
                        <SelectItem v-if="!user" value="clear-local-addresses" class="text-destructive focus:text-destructive">{{ messages.productCheckout.clearBrowserAddresses }}</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <p v-else-if="addressesLoading" class="text-sm text-muted-foreground">{{ messages.productCheckout.loadingSavedAddresses }}</p>
                  <div v-if="selectedAddress === 'new' || !addresses.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                    <VeeField v-for="field in addressFieldsWithoutPostalCode" :key="field.name" v-slot="{ componentField, errors }" :name="field.name" :validate-on-input="true">
                      <Field :data-invalid="errors.length > 0">
                        <FieldLabel :for="`checkout-${field.name}`"><span v-if="field.required" class="text-destructive">*</span> {{ field.label }}</FieldLabel>
                        <Input :id="`checkout-${field.name}`" v-bind="componentField" :autocomplete="field.autocomplete" :aria-invalid="errors.length > 0" class="h-11 bg-background shadow-none" />
                        <FieldError v-if="errors.length" :errors="errors" />
                      </Field>
                    </VeeField>
                    <div class="grid gap-4 sm:col-span-2 lg:col-span-1">
                      <VeeField v-slot="{ componentField, errors }" name="postalCode" :validate-on-input="true">
                        <Field :data-invalid="errors.length > 0">
                          <FieldLabel for="checkout-postalCode">{{ messages.productCheckout.address.postalCode }}</FieldLabel>
                          <Input id="checkout-postalCode" v-bind="componentField" autocomplete="postal-code" :aria-invalid="errors.length > 0" class="h-11 bg-background shadow-none" />
                          <FieldError v-if="errors.length" :errors="errors" />
                        </Field>
                      </VeeField>
                      <Button type="button" variant="outline" class="h-11 w-full shadow-none" :disabled="savingAddress" @click="saveCurrentAddress">{{ savingAddress ? messages.productCheckout.savingAddress : messages.productCheckout.saveAddress }}</Button>
                    </div>
                  </div>
                </FieldSet>
                <div v-if="methods.length" class="grid gap-2 text-sm font-medium">
                  <span>{{ messages.productCheckout.paymentMethod }}</span>
                  <div class="grid grid-cols-2 gap-2" role="group" :aria-label="messages.productCheckout.paymentMethod">
                    <Button v-for="item in methods" :key="item.key" type="button" :variant="selectedMethod === item.key ? 'default' : 'outline'" class="h-auto min-h-11 justify-start whitespace-normal rounded-md px-3 py-2 text-left text-sm leading-5 shadow-none" :aria-pressed="selectedMethod === item.key" @click="selectedMethod = item.key">
                      {{ item.name }}{{ item.channel ? `（${channelLabel(item.channel)}）` : "" }}
                    </Button>
                  </div>
                </div>
                <div class="grid gap-2 text-sm font-medium">
                  <span>{{ messages.productCheckout.discountCode }}</span>
                  <div class="flex gap-2">
                    <Input v-model="discountCode" autocomplete="off" class="h-11 min-w-0 shadow-none" @keydown.enter.prevent="onApplyDiscount" />
                    <Button type="button" variant="outline" class="h-11 shrink-0 shadow-none" :disabled="discountApplying || !discountCode.trim()" @click="onApplyDiscount">{{ discountApplying ? messages.productCheckout.applyingDiscount : messages.productCheckout.applyDiscount }}</Button>
                  </div>
                </div>
                <div v-if="discountPreview" class="grid gap-1.5 rounded-md border bg-muted/40 p-3 text-sm">
                  <div class="flex justify-between gap-4"><span class="text-muted-foreground">{{ messages.productCheckout.originalAmount }}</span><span class="tabular-nums">RM{{ discountPreview.originalAmount }}</span></div>
                  <div class="flex justify-between gap-4"><span class="text-muted-foreground">{{ t(messages.productCheckout.appliedDiscount, { code: discountPreview.code }) }}</span><span class="tabular-nums text-destructive">-RM{{ discountPreview.discountAmount }}</span></div>
                  <div class="flex justify-between gap-4 border-t pt-2 font-semibold"><span>{{ messages.productCheckout.amountDue }}</span><span class="tabular-nums">RM{{ discountPreview.finalAmount }}</span></div>
                </div>
                <label class="grid gap-2 text-sm font-medium">{{ messages.productCheckout.buyerNote }}<Textarea v-model="buyerNote" rows="3" class="shadow-none" /></label>
              </CardContent>
              <CardFooter class="flex-col items-stretch gap-3 px-5">
                <Button type="submit" class="h-12 w-full bg-primary text-base font-semibold text-primary-foreground shadow-sm hover:bg-primary/90" :disabled="loading || isOutOfStock || (requiresPayment && !methods.length)">{{ loading ? messages.productCheckout.processingOrder : isOutOfStock ? messages.storefront.outOfStock : requiresPayment ? messages.productCheckout.submitAndPay : messages.productCheckout.createFreeOrder }}</Button>
                <p class="text-xs leading-5 text-muted-foreground">{{ messages.productCheckout.paymentAmountNotice }}</p>
              </CardFooter>
            </form>
          </Card>
        </aside>
        <div class="min-w-0 space-y-6 lg:col-start-1 lg:row-start-2">
          <section v-if="data.description" class="rounded-md border bg-card p-5 sm:p-6">
            <h2 class="text-base font-semibold">{{ messages.productCheckout.productDetails }}</h2>
            <div ref="descriptionRef" class="product-rich-content mt-4 break-words text-sm leading-7 text-foreground [&_a]:text-primary [&_a]:underline [&_blockquote]:my-2 [&_blockquote]:border-l-[3px] [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-[1.1rem] [&_h3]:font-semibold [&_img]:my-4 [&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:cursor-zoom-in [&_img]:rounded-md [&_img]:border [&_img]:transition-opacity [&_img]:hover:opacity-90 [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6" @click="previewDescriptionImage" v-html="data.description" />
          </section>
          <section class="rounded-md border bg-muted/40 p-5 text-sm leading-6 sm:p-6">
            <h2 class="font-semibold">{{ messages.productCheckout.purchaseInstructions }}</h2>
            <div class="mt-3 grid gap-3 text-muted-foreground">
              <p class="whitespace-pre-wrap">{{ purchaseNote }}</p>
              <p v-if="deliveryHint" class="whitespace-pre-wrap">{{ deliveryHint }}</p>
            </div>
          </section>
        </div>
      </section>
      <StorefrontFooter />
    </div>
    <Dialog :open="Boolean(previewImage)" @update:open="(open) => { if (!open) previewImage = null; }">
      <DialogContent :show-close-button="false" class="w-fit! max-w-[calc(100vw-2rem)]! border-0 bg-transparent p-0 shadow-none sm:max-w-[calc(100vw-4rem)]!" @interact-outside="previewImage = null">
        <DialogTitle class="sr-only">{{ messages.productCheckout.imagePreview }}</DialogTitle>
        <div class="relative inline-flex">
          <img v-if="previewImage" :src="previewImage.src" :alt="previewImage.alt" class="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] rounded-md object-contain sm:max-w-[calc(100vw-4rem)]" />
          <DialogClose as-child><Button type="button" variant="ghost" size="icon" class="absolute right-2 top-2 size-10 rounded-full bg-black/55 text-white hover:bg-black/75 hover:text-white" :aria-label="messages.productCheckout.closeImagePreview"><XIcon /></Button></DialogClose>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog :open="clearAddressesDialogOpen" @update:open="(open) => { clearAddressesDialogOpen = open; if (!open) selectedAddress = previousAddressSelection; }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ messages.productCheckout.confirmClearAddressesTitle }}</DialogTitle>
          <DialogDescription>{{ messages.productCheckout.confirmClearAddressesDescription }}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" @click="clearAddressesDialogOpen = false">{{ messages.productCheckout.cancel }}</Button>
          <Button type="button" variant="destructive" @click="confirmClearSavedAddresses">{{ messages.productCheckout.confirmClearAddresses }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </main>
</template>
