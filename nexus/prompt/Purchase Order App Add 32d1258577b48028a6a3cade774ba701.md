# Purchase Order App Add

1. add a expandable/hideable sidebar menu on the left that lists other page links. the current app PAMS would be on the list as well as Orders, Invoices, Shipments
2. Purchase Order Management Page
    1. Lists Orders as a block (OrderBlock) with Order details inside.
        1. Order # (auto assigned sequence, able to setup custom format, example: PO-00001)
        2. Order Date (click to show DatePicker mini calendar that shows the current month, able to change months by clicking left or right button at the top, clicking a date sets the date and closes the date picker)
        3. list of items (OrderItem) that are part of the order (these are the same item from the PAMS page)
            1. Item name (drop down, single select)
            2. Category (drop down, single select, any existing category)
            3. Version (drop down, single select, available versions for the item)
            4. Approval Status (drop down, single select)
            5. Notes (free long text field)
            6. Order QTY (number only field)
            7. Item Order Status (drop down, single select, new field)
                1. Options: New (red), Final (green), Cancel (grey)
            8. “Artwork” button. opens the ArtworkUpload modal which has exact same layout and functions from the left pane in the artwork review app (item info, upload area, upload history) but inside a popup modal
        4. Add Item button at the bottom of the item list. same width as orderitem.
            1. adds a row in the item list with blank fields
                1. select item name from the drop down
                2. Item Order Status is New by default
        5. Compress the UI on the OrderItems for example; small padding, small spacing between fields, small font; because it is important to be able to see a lot of items in an order without scrolling. 
        6. The fields on OrderItems should be able to edit directly without having to click in to the orderitem.
3. User flows
    1. Create new order
        1. Click Create New Order button at top right
        2. creates a new OrderBlock with the Order # auto filled based on order# rules
        3. Order Date default to today
        4. 1 blank OrderItem already added, ready to fill in info
    2. Add OrderItems
    3. Edit OrderItems anytime
    4. Upload artwork for OrderItems
        1. click Artwork button on the OrderItem
        2. opens the ArtworkUpload modal
        3. Uploads files in the same way as PAMS
    5. When artwork status is updated for a item/category/version, it should show the live update on OrderItem in OrderBlock