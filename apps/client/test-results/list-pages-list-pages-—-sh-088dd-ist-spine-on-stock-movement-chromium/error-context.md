# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: list-pages.spec.ts >> list pages — shared spine >> renders list spine on stock movement
- Location: src/tests/e2e/list-pages.spec.ts:57:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForLoadState: Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e7]:
    - generic [ref=e8]:
      - button "Toggle sidebar" [ref=e9] [cursor=pointer]:
        - img
      - paragraph [ref=e10]: Warehouse ERP
    - generic [ref=e11]:
      - generic [ref=e12]:
        - button "EN Language" [ref=e13] [cursor=pointer]:
          - generic [ref=e14]: EN
          - img [ref=e15]
        - combobox [ref=e19]
      - button "Notifications" [ref=e21] [cursor=pointer]:
        - img
      - button "Theme" [ref=e22] [cursor=pointer]:
        - img
      - button "User menu" [ref=e23] [cursor=pointer]:
        - generic "User menu" [ref=e24]:
          - generic [ref=e26]: A
          - generic [ref=e27]:
            - paragraph [ref=e28]: Admin
            - paragraph [ref=e29]: System Admin
  - generic [ref=e30]:
    - complementary [ref=e31]:
      - generic [ref=e33]:
        - generic [ref=e35]: Menu
        - navigation [ref=e37]:
          - button "Dashboard" [ref=e38] [cursor=pointer]:
            - generic [ref=e39]:
              - img
            - text: Dashboard
          - heading "Access Control" [level=3] [ref=e42]:
            - button "Access Control" [ref=e43] [cursor=pointer]:
              - img [ref=e45]
              - text: Access Control
              - img [ref=e53]
          - button "Warehouses" [ref=e55] [cursor=pointer]:
            - generic [ref=e56]:
              - img
            - text: Warehouses
          - button "SKUs" [ref=e57] [cursor=pointer]:
            - generic [ref=e58]:
              - img
            - text: SKUs
          - button "Suppliers" [ref=e59] [cursor=pointer]:
            - generic [ref=e60]:
              - img
            - text: Suppliers
          - button "Products" [ref=e61] [cursor=pointer]:
            - generic [ref=e62]:
              - img
            - text: Products
          - button "Activity Logs" [ref=e63] [cursor=pointer]:
            - generic [ref=e64]:
              - img
            - text: Activity Logs
          - button "Notifications" [ref=e65] [cursor=pointer]:
            - generic [ref=e66]:
              - img:
                - generic: "3"
            - text: Notifications
          - button "Inbound Transactions" [ref=e67] [cursor=pointer]:
            - generic [ref=e68]:
              - img
            - text: Inbound Transactions
          - button "Outbound Transactions" [ref=e69] [cursor=pointer]:
            - generic [ref=e70]:
              - img
            - text: Outbound Transactions
          - button "Subinventory Transfer" [ref=e71] [cursor=pointer]:
            - generic [ref=e72]:
              - img
            - text: Subinventory Transfer
          - button "Pallets" [ref=e73] [cursor=pointer]:
            - generic [ref=e74]:
              - img
            - text: Pallets
          - button "Stock Movements" [ref=e75] [cursor=pointer]:
            - generic [ref=e76]:
              - img
            - text: Stock Movements
          - heading "Reports" [level=3] [ref=e79]:
            - button "Reports" [ref=e80] [cursor=pointer]:
              - img [ref=e82]
              - text: Reports
              - img [ref=e93]
          - button "Inventory Aging" [ref=e95] [cursor=pointer]:
            - generic [ref=e96]:
              - img
            - text: Inventory Aging
          - button "AI System Admin" [ref=e97] [cursor=pointer]:
            - generic [ref=e98]:
              - img
            - text: AI System Admin
    - main [ref=e99]:
      - generic [ref=e100]:
        - generic [ref=e102]:
          - heading "Stock Movements" [level=1] [ref=e103]
          - paragraph [ref=e104]: Immutable audit log of all approved inventory movements.
        - generic [ref=e105]:
          - generic [ref=e106]:
            - generic [ref=e107]: Total IN
            - generic [ref=e108]: +7,680
          - generic [ref=e109]:
            - generic [ref=e110]: Total OUT
            - generic [ref=e111]: "-16,537"
          - generic [ref=e112]:
            - generic [ref=e113]: Net Flow
            - generic [ref=e114]: "-8,857"
          - generic [ref=e115]:
            - generic [ref=e116]: Records
            - generic [ref=e117]: "201"
        - generic [ref=e119]:
          - textbox "Search document ID / number…" [ref=e120]
          - generic [ref=e121]:
            - button "All" [pressed] [ref=e122]:
              - generic [ref=e123]: All
            - button "IN" [ref=e124]:
              - text: solar:arrow-to-bottom-down-bold
              - generic [ref=e125]: IN
            - button "OUT" [ref=e126]:
              - text: solar:arrow-to-top-up-bold
              - generic [ref=e127]: OUT
            - button "NONE" [ref=e128]:
              - text: solar:transfer-horizontal-linear
              - generic [ref=e129]: NONE
          - generic [ref=e130]:
            - generic [ref=e131]:
              - button "Today" [ref=e132]:
                - generic [ref=e133]: Today
              - button "7d" [ref=e134]:
                - generic [ref=e135]: 7d
              - button "30d" [ref=e136]:
                - generic [ref=e137]: 30d
              - button "Month" [ref=e138]:
                - generic [ref=e139]: Month
              - button "Custom" [pressed] [ref=e140]:
                - generic [ref=e141]: Custom
            - generic [ref=e142]:
              - textbox [ref=e143]
              - generic [ref=e144]: to
              - textbox [ref=e145]
          - generic [ref=e146]:
            - button "All" [pressed] [ref=e147]:
              - generic [ref=e148]: All
            - button "Receiving (GR)" [ref=e149]:
              - generic [ref=e150]: Receiving (GR)
            - button "WIP Completion (FGR)" [ref=e151]:
              - generic [ref=e152]: WIP Completion (FGR)
            - button "RMA Receipt (CRR)" [ref=e153]:
              - generic [ref=e154]: RMA Receipt (CRR)
            - button "WIP Issue (MI)" [ref=e155]:
              - generic [ref=e156]: WIP Issue (MI)
            - button "Shipment (DO)" [ref=e157]:
              - generic [ref=e158]: Shipment (DO)
            - button "Return to Supplier (SR)" [ref=e159]:
              - generic [ref=e160]: Return to Supplier (SR)
            - button "+4 more" [ref=e161]
          - button "Show filters" [ref=e162] [cursor=pointer]:
            - img
            - text: Show filters
        - generic [ref=e163]:
          - generic [ref=e165]:
            - generic [ref=e166]:
              - img [ref=e167]
              - generic [ref=e169]: Movements
            - generic [ref=e170]: 201 records
          - separator [ref=e171]
          - generic [ref=e173]:
            - grid "Stock movements table" [ref=e175]:
              - rowgroup [ref=e176]:
                - row "Date Document Type Direction SKU Warehouse Qty Signed Qty Notes" [ref=e177]:
                  - columnheader "Date" [ref=e178]:
                    - generic [ref=e179]: Date
                  - columnheader "Document" [ref=e180]:
                    - generic [ref=e181]: Document
                  - columnheader "Type" [ref=e182]:
                    - generic [ref=e183]: Type
                  - columnheader "Direction" [ref=e184]:
                    - generic [ref=e185]: Direction
                  - columnheader "SKU" [ref=e186]:
                    - generic [ref=e187]: SKU
                  - columnheader "Warehouse" [ref=e188]:
                    - generic [ref=e189]: Warehouse
                  - columnheader "Qty" [ref=e190]:
                    - generic [ref=e191]: Qty
                  - columnheader "Signed Qty" [ref=e192]:
                    - generic [ref=e193]: Signed Qty
                  - columnheader "Notes" [ref=e194]:
                    - generic [ref=e195]: Notes
              - rowgroup [ref=e196]:
                - row "FND/WH01/07/2026/0001" [ref=e197]:
                  - gridcell "7/26/2026" [ref=e198]
                  - rowheader "FND/WH01/07/2026/0001" [ref=e199]:
                    - generic [ref=e201]: FND/WH01/07/2026/0001
                  - gridcell "Found (FO)" [ref=e202]
                  - gridcell "IN" [ref=e203]:
                    - generic [ref=e204]: IN
                  - gridcell "Refined Cooking Oil 1L FG-OIL-1L" [ref=e205]:
                    - generic [ref=e206]:
                      - generic [ref=e207]: Refined Cooking Oil 1L
                      - generic [ref=e208]: FG-OIL-1L
                  - gridcell "Raw Material Hub" [ref=e209]
                  - gridcell "1,440" [ref=e210]
                  - gridcell "+1,440" [ref=e211]
                  - gridcell "Auto-generated fake movement for FND/WH01/07/2026/0001" [ref=e212]
                - row "FND/WH01/07/2026/0001" [ref=e213]:
                  - gridcell "7/26/2026" [ref=e214]
                  - rowheader "FND/WH01/07/2026/0001" [ref=e215]:
                    - generic [ref=e217]: FND/WH01/07/2026/0001
                  - gridcell "Found (FO)" [ref=e218]
                  - gridcell "IN" [ref=e219]:
                    - generic [ref=e220]: IN
                  - gridcell "PP Woven Sack 10kg PM-SACK-PP-10" [ref=e221]:
                    - generic [ref=e222]:
                      - generic [ref=e223]: PP Woven Sack 10kg
                      - generic [ref=e224]: PM-SACK-PP-10
                  - gridcell "Raw Material Hub" [ref=e225]
                  - gridcell "4,000" [ref=e226]
                  - gridcell "+4,000" [ref=e227]
                  - gridcell "Auto-generated fake movement for FND/WH01/07/2026/0001" [ref=e228]
                - row "FND/WH01/07/2026/0001" [ref=e229]:
                  - gridcell "7/26/2026" [ref=e230]
                  - rowheader "FND/WH01/07/2026/0001" [ref=e231]:
                    - generic [ref=e233]: FND/WH01/07/2026/0001
                  - gridcell "Found (FO)" [ref=e234]
                  - gridcell "IN" [ref=e235]:
                    - generic [ref=e236]: IN
                  - gridcell "Refined White Sugar 1kg FG-SUGAR-1KG" [ref=e237]:
                    - generic [ref=e238]:
                      - generic [ref=e239]: Refined White Sugar 1kg
                      - generic [ref=e240]: FG-SUGAR-1KG
                  - gridcell "Raw Material Hub" [ref=e241]
                  - gridcell "2,000" [ref=e242]
                  - gridcell "+2,000" [ref=e243]
                  - gridcell "Auto-generated fake movement for FND/WH01/07/2026/0001" [ref=e244]
                - row "SHP/WH03/07/2026/0001" [ref=e245]:
                  - gridcell "7/25/2026" [ref=e246]
                  - rowheader "SHP/WH03/07/2026/0001" [ref=e247]:
                    - generic [ref=e249]: SHP/WH03/07/2026/0001
                  - gridcell "Shipment (DO)" [ref=e250]
                  - gridcell "OUT" [ref=e251]:
                    - generic [ref=e252]: OUT
                  - gridcell "Retail Carton Box (6-pack) PM-CARTON-01" [ref=e253]:
                    - generic [ref=e254]:
                      - generic [ref=e255]: Retail Carton Box (6-pack)
                      - generic [ref=e256]: PM-CARTON-01
                  - gridcell "Finished Goods Distribution Center" [ref=e257]
                  - gridcell "1,200" [ref=e258]
                  - gridcell "-1,200" [ref=e259]
                  - gridcell "Auto-generated fake movement for SHP/WH03/07/2026/0001" [ref=e260]
                - row "SHP/WH03/07/2026/0001" [ref=e261]:
                  - gridcell "7/25/2026" [ref=e262]
                  - rowheader "SHP/WH03/07/2026/0001" [ref=e263]:
                    - generic [ref=e265]: SHP/WH03/07/2026/0001
                  - gridcell "Shipment (DO)" [ref=e266]
                  - gridcell "OUT" [ref=e267]:
                    - generic [ref=e268]: OUT
                  - gridcell "Crude Palm Oil IBC 200L RM-OIL-200" [ref=e269]:
                    - generic [ref=e270]:
                      - generic [ref=e271]: Crude Palm Oil IBC 200L
                      - generic [ref=e272]: RM-OIL-200
                  - gridcell "Finished Goods Distribution Center" [ref=e273]
                  - gridcell "200" [ref=e274]
                  - gridcell "-200" [ref=e275]
                  - gridcell "Auto-generated fake movement for SHP/WH03/07/2026/0001" [ref=e276]
                - row "SHP/WH03/07/2026/0001" [ref=e277]:
                  - gridcell "7/25/2026" [ref=e278]
                  - rowheader "SHP/WH03/07/2026/0001" [ref=e279]:
                    - generic [ref=e281]: SHP/WH03/07/2026/0001
                  - gridcell "Shipment (DO)" [ref=e282]
                  - gridcell "OUT" [ref=e283]:
                    - generic [ref=e284]: OUT
                  - gridcell "Raw Rice Paddy 50kg RM-RICE-50" [ref=e285]:
                    - generic [ref=e286]:
                      - generic [ref=e287]: Raw Rice Paddy 50kg
                      - generic [ref=e288]: RM-RICE-50
                  - gridcell "Finished Goods Distribution Center" [ref=e289]
                  - gridcell "1,000" [ref=e290]
                  - gridcell "-1,000" [ref=e291]
                  - gridcell "Auto-generated fake movement for SHP/WH03/07/2026/0001" [ref=e292]
                - row "WIS/WH01/07/2026/0001" [ref=e293]:
                  - gridcell "7/24/2026" [ref=e294]
                  - rowheader "WIS/WH01/07/2026/0001" [ref=e295]:
                    - generic [ref=e297]: WIS/WH01/07/2026/0001
                  - gridcell "WIP Issue (MI)" [ref=e298]
                  - gridcell "OUT" [ref=e299]:
                    - generic [ref=e300]: OUT
                  - gridcell "Premium Cooking Pack FG-COOK-01" [ref=e301]:
                    - generic [ref=e302]:
                      - generic [ref=e303]: Premium Cooking Pack
                      - generic [ref=e304]: FG-COOK-01
                  - gridcell "Raw Material Hub" [ref=e305]
                  - gridcell "96" [ref=e306]
                  - gridcell "-96" [ref=e307]
                  - gridcell "Auto-generated fake movement for WIS/WH01/07/2026/0001" [ref=e308]
                - row "WCP/WH02/07/2026/0001" [ref=e309]:
                  - gridcell "7/24/2026" [ref=e310]
                  - rowheader "WCP/WH02/07/2026/0001" [ref=e311]:
                    - generic [ref=e313]: WCP/WH02/07/2026/0001
                  - gridcell "WIP Completion (FGR)" [ref=e314]
                  - gridcell "IN" [ref=e315]:
                    - generic [ref=e316]: IN
                  - gridcell "Premium Cooking Pack FG-COOK-01" [ref=e317]:
                    - generic [ref=e318]:
                      - generic [ref=e319]: Premium Cooking Pack
                      - generic [ref=e320]: FG-COOK-01
                  - gridcell "Production Buffer Warehouse" [ref=e321]
                  - gridcell "192" [ref=e322]
                  - gridcell "+192" [ref=e323]
                  - gridcell "Auto-generated fake movement for WCP/WH02/07/2026/0001" [ref=e324]
                - row "WIS/WH01/07/2026/0001" [ref=e325]:
                  - gridcell "7/24/2026" [ref=e326]
                  - rowheader "WIS/WH01/07/2026/0001" [ref=e327]:
                    - generic [ref=e329]: WIS/WH01/07/2026/0001
                  - gridcell "WIP Issue (MI)" [ref=e330]
                  - gridcell "OUT" [ref=e331]:
                    - generic [ref=e332]: OUT
                  - gridcell "Crude Palm Oil Drum 20L RM-OIL-20" [ref=e333]:
                    - generic [ref=e334]:
                      - generic [ref=e335]: Crude Palm Oil Drum 20L
                      - generic [ref=e336]: RM-OIL-20
                  - gridcell "Raw Material Hub" [ref=e337]
                  - gridcell "480" [ref=e338]
                  - gridcell "-480" [ref=e339]
                  - gridcell "Auto-generated fake movement for WIS/WH01/07/2026/0001" [ref=e340]
                - row "WIS/WH01/07/2026/0001" [ref=e341]:
                  - gridcell "7/24/2026" [ref=e342]
                  - rowheader "WIS/WH01/07/2026/0001" [ref=e343]:
                    - generic [ref=e345]: WIS/WH01/07/2026/0001
                  - gridcell "WIP Issue (MI)" [ref=e346]
                  - gridcell "OUT" [ref=e347]:
                    - generic [ref=e348]: OUT
                  - gridcell "Bottle Cap Standard PM-CAP-STD" [ref=e349]:
                    - generic [ref=e350]:
                      - generic [ref=e351]: Bottle Cap Standard
                      - generic [ref=e352]: PM-CAP-STD
                  - gridcell "Raw Material Hub" [ref=e353]
                  - gridcell "1" [ref=e354]
                  - gridcell "-1" [ref=e355]
                  - gridcell "Auto-generated fake movement for WIS/WH01/07/2026/0001" [ref=e356]
                - row "WIS/WH01/07/2026/0001" [ref=e357]:
                  - gridcell "7/24/2026" [ref=e358]
                  - rowheader "WIS/WH01/07/2026/0001" [ref=e359]:
                    - generic [ref=e361]: WIS/WH01/07/2026/0001
                  - gridcell "WIP Issue (MI)" [ref=e362]
                  - gridcell "OUT" [ref=e363]:
                    - generic [ref=e364]: OUT
                  - gridcell "Refined White Sugar 1kg FG-SUGAR-1KG" [ref=e365]:
                    - generic [ref=e366]:
                      - generic [ref=e367]: Refined White Sugar 1kg
                      - generic [ref=e368]: FG-SUGAR-1KG
                  - gridcell "Raw Material Hub" [ref=e369]
                  - gridcell "1,000" [ref=e370]
                  - gridcell "-1,000" [ref=e371]
                  - gridcell "Auto-generated fake movement for WIS/WH01/07/2026/0001" [ref=e372]
                - row "DSP/WH01/07/2026/0001" [ref=e373]:
                  - gridcell "7/22/2026" [ref=e374]
                  - rowheader "DSP/WH01/07/2026/0001" [ref=e375]:
                    - generic [ref=e377]: DSP/WH01/07/2026/0001
                  - gridcell "Disposal (DS)" [ref=e378]
                  - gridcell "OUT" [ref=e379]:
                    - generic [ref=e380]: OUT
                  - gridcell "Refined Cooking Oil 1L FG-OIL-1L" [ref=e381]:
                    - generic [ref=e382]:
                      - generic [ref=e383]: Refined Cooking Oil 1L
                      - generic [ref=e384]: FG-OIL-1L
                  - gridcell "Raw Material Hub" [ref=e385]
                  - gridcell "1,440" [ref=e386]
                  - gridcell "-1,440" [ref=e387]
                  - gridcell "Auto-generated fake movement for DSP/WH01/07/2026/0001" [ref=e388]
                - row "DSP/WH01/07/2026/0001" [ref=e389]:
                  - gridcell "7/22/2026" [ref=e390]
                  - rowheader "DSP/WH01/07/2026/0001" [ref=e391]:
                    - generic [ref=e393]: DSP/WH01/07/2026/0001
                  - gridcell "Disposal (DS)" [ref=e394]
                  - gridcell "OUT" [ref=e395]:
                    - generic [ref=e396]: OUT
                  - gridcell "Refined White Sugar 1kg FG-SUGAR-1KG" [ref=e397]:
                    - generic [ref=e398]:
                      - generic [ref=e399]: Refined White Sugar 1kg
                      - generic [ref=e400]: FG-SUGAR-1KG
                  - gridcell "Raw Material Hub" [ref=e401]
                  - gridcell "1,000" [ref=e402]
                  - gridcell "-1,000" [ref=e403]
                  - gridcell "Auto-generated fake movement for DSP/WH01/07/2026/0001" [ref=e404]
                - row "RTS/WH02/07/2026/0001" [ref=e405]:
                  - gridcell "7/22/2026" [ref=e406]
                  - rowheader "RTS/WH02/07/2026/0001" [ref=e407]:
                    - generic [ref=e409]: RTS/WH02/07/2026/0001
                  - gridcell "Return to Supplier (SR)" [ref=e410]
                  - gridcell "OUT" [ref=e411]:
                    - generic [ref=e412]: OUT
                  - gridcell "PET Bottle 2L (blank) PM-BOTTLE-2L" [ref=e413]:
                    - generic [ref=e414]:
                      - generic [ref=e415]: PET Bottle 2L (blank)
                      - generic [ref=e416]: PM-BOTTLE-2L
                  - gridcell "Production Buffer Warehouse" [ref=e417]
                  - gridcell "2,400" [ref=e418]
                  - gridcell "-2,400" [ref=e419]
                  - gridcell "Auto-generated fake movement for RTS/WH02/07/2026/0001" [ref=e420]
                - row "RTS/WH02/07/2026/0001" [ref=e421]:
                  - gridcell "7/22/2026" [ref=e422]
                  - rowheader "RTS/WH02/07/2026/0001" [ref=e423]:
                    - generic [ref=e425]: RTS/WH02/07/2026/0001
                  - gridcell "Return to Supplier (SR)" [ref=e426]
                  - gridcell "OUT" [ref=e427]:
                    - generic [ref=e428]: OUT
                  - gridcell "Premium Cooking Pack FG-COOK-01" [ref=e429]:
                    - generic [ref=e430]:
                      - generic [ref=e431]: Premium Cooking Pack
                      - generic [ref=e432]: FG-COOK-01
                  - gridcell "Production Buffer Warehouse" [ref=e433]
                  - gridcell "48" [ref=e434]
                  - gridcell "-48" [ref=e435]
                  - gridcell "Auto-generated fake movement for RTS/WH02/07/2026/0001" [ref=e436]
                - row "DSP/WH01/07/2026/0001" [ref=e437]:
                  - gridcell "7/22/2026" [ref=e438]
                  - rowheader "DSP/WH01/07/2026/0001" [ref=e439]:
                    - generic [ref=e441]: DSP/WH01/07/2026/0001
                  - gridcell "Disposal (DS)" [ref=e442]
                  - gridcell "OUT" [ref=e443]:
                    - generic [ref=e444]: OUT
                  - gridcell "PET Bottle 1L (blank) PM-BOTTLE-1L" [ref=e445]:
                    - generic [ref=e446]:
                      - generic [ref=e447]: PET Bottle 1L (blank)
                      - generic [ref=e448]: PM-BOTTLE-1L
                  - gridcell "Raw Material Hub" [ref=e449]
                  - gridcell "6,000" [ref=e450]
                  - gridcell "-6,000" [ref=e451]
                  - gridcell "Auto-generated fake movement for DSP/WH01/07/2026/0001" [ref=e452]
                - row "WIS/WH02/07/2026/0001" [ref=e453]:
                  - gridcell "7/21/2026" [ref=e454]
                  - rowheader "WIS/WH02/07/2026/0001" [ref=e455]:
                    - generic [ref=e457]: WIS/WH02/07/2026/0001
                  - gridcell "WIP Issue (MI)" [ref=e458]
                  - gridcell "OUT" [ref=e459]:
                    - generic [ref=e460]: OUT
                  - gridcell "Premium Cooking Pack FG-COOK-01" [ref=e461]:
                    - generic [ref=e462]:
                      - generic [ref=e463]: Premium Cooking Pack
                      - generic [ref=e464]: FG-COOK-01
                  - gridcell "Production Buffer Warehouse" [ref=e465]
                  - gridcell "96" [ref=e466]
                  - gridcell "-96" [ref=e467]
                  - gridcell "Auto-generated fake movement for WIS/WH02/07/2026/0001" [ref=e468]
                - row "WIS/WH02/07/2026/0001" [ref=e469]:
                  - gridcell "7/21/2026" [ref=e470]
                  - rowheader "WIS/WH02/07/2026/0001" [ref=e471]:
                    - generic [ref=e473]: WIS/WH02/07/2026/0001
                  - gridcell "WIP Issue (MI)" [ref=e474]
                  - gridcell "OUT" [ref=e475]:
                    - generic [ref=e476]: OUT
                  - gridcell "Refined Cooking Oil 2L FG-OIL-2L" [ref=e477]:
                    - generic [ref=e478]:
                      - generic [ref=e479]: Refined Cooking Oil 2L
                      - generic [ref=e480]: FG-OIL-2L
                  - gridcell "Production Buffer Warehouse" [ref=e481]
                  - gridcell "576" [ref=e482]
                  - gridcell "-576" [ref=e483]
                  - gridcell "Auto-generated fake movement for WIS/WH02/07/2026/0001" [ref=e484]
                - row "WIS/WH02/07/2026/0001" [ref=e485]:
                  - gridcell "7/21/2026" [ref=e486]
                  - rowheader "WIS/WH02/07/2026/0001" [ref=e487]:
                    - generic [ref=e489]: WIS/WH02/07/2026/0001
                  - gridcell "WIP Issue (MI)" [ref=e490]
                  - gridcell "OUT" [ref=e491]:
                    - generic [ref=e492]: OUT
                  - gridcell "Raw Rice Paddy 25kg RM-RICE-25" [ref=e493]:
                    - generic [ref=e494]:
                      - generic [ref=e495]: Raw Rice Paddy 25kg
                      - generic [ref=e496]: RM-RICE-25
                  - gridcell "Production Buffer Warehouse" [ref=e497]
                  - gridcell "1,000" [ref=e498]
                  - gridcell "-1,000" [ref=e499]
                  - gridcell "Auto-generated fake movement for WIS/WH02/07/2026/0001" [ref=e500]
                - row "RMA/WH03/07/2026/0001" [ref=e501]:
                  - gridcell "7/21/2026" [ref=e502]
                  - rowheader "RMA/WH03/07/2026/0001" [ref=e503]:
                    - generic [ref=e505]: RMA/WH03/07/2026/0001
                  - gridcell "RMA Receipt (CRR)" [ref=e506]
                  - gridcell "IN" [ref=e507]:
                    - generic [ref=e508]: IN
                  - gridcell "Premium Cooking Pack FG-COOK-01" [ref=e509]:
                    - generic [ref=e510]:
                      - generic [ref=e511]: Premium Cooking Pack
                      - generic [ref=e512]: FG-COOK-01
                  - gridcell "Finished Goods Distribution Center" [ref=e513]
                  - gridcell "48" [ref=e514]
                  - gridcell "+48" [ref=e515]
                  - gridcell "Auto-generated fake movement for RMA/WH03/07/2026/0001" [ref=e516]
            - navigation "pagination" [ref=e518]:
              - generic [ref=e519]: 1 to 20 of 201 results
              - list [ref=e520]:
                - listitem [ref=e521]:
                  - button "Prev" [disabled]:
                    - generic:
                      - img
                    - text: Prev
                - listitem [ref=e522]:
                  - button "1" [ref=e523] [cursor=pointer]
                - listitem [ref=e524]:
                  - button "2" [ref=e525] [cursor=pointer]
                - listitem [ref=e526]:
                  - button "3" [ref=e527] [cursor=pointer]
                - listitem [ref=e528]:
                  - button "4" [ref=e529] [cursor=pointer]
                - listitem [ref=e530]:
                  - button "5" [ref=e531] [cursor=pointer]
                - listitem [ref=e532]:
                  - button "6" [ref=e533] [cursor=pointer]
                - listitem [ref=e534]:
                  - button "7" [ref=e535] [cursor=pointer]
                - listitem [ref=e536]:
                  - button "8" [ref=e537] [cursor=pointer]
                - listitem [ref=e538]:
                  - button "9" [ref=e539] [cursor=pointer]
                - listitem [ref=e540]:
                  - button "10" [ref=e541] [cursor=pointer]
                - listitem [ref=e542]:
                  - button "11" [ref=e543] [cursor=pointer]
                - listitem [ref=e544]:
                  - button "Next" [ref=e545] [cursor=pointer]:
                    - text: Next
                    - img [ref=e547]
  - button [ref=e551] [cursor=pointer]:
    - img
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test';
  2   | import { loginAsAdmin } from './helpers/auth';
  3   | 
  4   | /**
  5   |  * Shared-spine regression coverage for the `useListPage` + `<DataTable>`
  6   |  * consolidation. Every migrated index/sub-table page renders through the same
  7   |  * spine, so a single data-independent pass proves the spine still works per-page:
  8   |  * the table mounts, rows render (or the empty state shows), and the pagination
  9   |  * footer is present.
  10  |  *
  11  |  * Run: bun run test -- --grep "list pages"
  12  |  */
  13  | 
  14  | const LIST_ROUTES = [
  15  |   // Index pages
  16  |   { name: 'suppliers', path: '/suppliers' },
  17  |   { name: 'warehouses', path: '/warehouses' },
  18  |   { name: 'skus', path: '/skus' },
  19  |   { name: 'products', path: '/products' },
  20  |   { name: 'users', path: '/users' },
  21  |   { name: 'pallets', path: '/pallets' },
  22  |   { name: 'stock movement', path: '/stock-movement' },
  23  |   // Transaction sub-tables
  24  |   { name: 'receiving', path: '/inbound-transaction/receiving' },
  25  |   { name: 'wip completion', path: '/inbound-transaction/wip-completion' },
  26  |   { name: 'rma receipt', path: '/inbound-transaction/rma-receipt' },
  27  |   { name: 'found', path: '/inbound-transaction/found' },
  28  |   { name: 'shipment', path: '/outbound-transaction/shipment' },
  29  |   { name: 'disposal', path: '/outbound-transaction/disposal' },
  30  |   { name: 'loss', path: '/outbound-transaction/loss' },
  31  |   { name: 'return to supplier', path: '/outbound-transaction/return-to-supplier' },
  32  |   { name: 'wip issue', path: '/outbound-transaction/wip-issue' },
  33  |   { name: 'subinventory transfer', path: '/subinventory-transfer' },
  34  | ];
  35  | 
  36  | async function assertListSpine(page: Page): Promise<void> {
  37  |   // Table region mounts.
  38  |   await expect(page.getByRole('table')).toBeAttached({ timeout: 15000 });
  39  | 
  40  |   // Either rows rendered or the empty state is shown — data-independent.
  41  |   const rowCount = await page.getByRole('row').count();
  42  |   if (rowCount <= 1) {
  43  |     // 1 row = header only → empty state must be visible.
  44  |     await expect(page.getByText(/no .*found|empty/i).first()).toBeVisible({ timeout: 10000 });
  45  |   }
  46  | 
  47  |   // Pagination footer present.
  48  |   await expect(page.getByText(/of \d+ results/).first()).toBeAttached({ timeout: 10000 });
  49  | }
  50  | 
  51  | test.describe('list pages — shared spine', () => {
  52  |   test.beforeEach(async ({ page }) => {
  53  |     await loginAsAdmin(page);
  54  |   });
  55  | 
  56  |   for (const route of LIST_ROUTES) {
  57  |     test(`renders list spine on ${route.name}`, async ({ page }) => {
  58  |       await page.goto(route.path);
> 59  |       await page.waitForLoadState('networkidle');
      |                  ^ Error: page.waitForLoadState: Test timeout of 30000ms exceeded.
  60  |       await assertListSpine(page);
  61  |     });
  62  |   }
  63  | });
  64  | 
  65  | test.describe('list pages — pagination regression', () => {
  66  |   test.beforeEach(async ({ page }) => {
  67  |     await loginAsAdmin(page);
  68  |   });
  69  | 
  70  |   test('stock movement advances to page 2 without resetting', async ({ page }) => {
  71  |     await page.goto('/stock-movement');
  72  |     await page.waitForLoadState('networkidle');
  73  |     await expect(page.getByRole('table')).toBeAttached({ timeout: 15000 });
  74  | 
  75  |     const summary = page.getByText(/of \d+ results/).first();
  76  |     await expect(summary).toBeAttached({ timeout: 10000 });
  77  | 
  78  |     // Capture the starting "X to Y" range.
  79  |     const before = (await summary.innerText()).trim();
  80  | 
  81  |     // Click the "Next" pagination link (guarded: only if enabled).
  82  |     const next = page.getByRole('link', { name: /next/i }).first();
  83  |     if (!(await next.isDisabled().catch(() => true))) {
  84  |       await next.click();
  85  |       await page.waitForLoadState('networkidle');
  86  |       const after = (await summary.innerText()).trim();
  87  |       // Range must change (page advanced) and not collapse back to page 1 start.
  88  |       expect(after).not.toEqual(before);
  89  |     }
  90  |   });
  91  | });
  92  | 
  93  | test.describe('list pages — search filter', () => {
  94  |   test.beforeEach(async ({ page }) => {
  95  |     await loginAsAdmin(page);
  96  |   });
  97  | 
  98  |   test('suppliers search updates results after debounce', async ({ page }) => {
  99  |     await page.goto('/suppliers');
  100 |     await page.waitForLoadState('networkidle');
  101 |     await expect(page.getByRole('table')).toBeAttached({ timeout: 15000 });
  102 | 
  103 |     const search = page.getByPlaceholder(/search/i).first();
  104 |     await expect(search).toBeVisible({ timeout: 5000 });
  105 | 
  106 |     // Nonsense query → empty state (guards debounced search path).
  107 |     await search.fill('zzzzzz-no-such-record-zzzzzz');
  108 |     await page.waitForTimeout(800); // debounce (300ms) + query settle
  109 |     await page.waitForLoadState('networkidle');
  110 |     await expect(page.getByText(/no .*found|empty/i).first()).toBeVisible({ timeout: 10000 });
  111 |   });
  112 | });
  113 | 
```