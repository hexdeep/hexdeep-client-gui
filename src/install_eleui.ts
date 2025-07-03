import { Autocomplete, Breadcrumb, BreadcrumbItem, Button, Card, Checkbox, CheckboxGroup, DatePicker, Descriptions, DescriptionsItem, Divider, Dropdown, DropdownItem, DropdownMenu, Form, FormItem, Image, Input, InputNumber, Link, Loading, Message, MessageBox, Option, OptionGroup, Pagination, Popover, Progress, Radio, RadioButton, RadioGroup, Select, Skeleton, SkeletonItem, Slider, Switch, TabPane, Table, TableColumn, Tabs, Tag, Tooltip, Transfer, Tree, Upload } from "element-ui";
import { ElImage } from "element-ui/types/image";
import Vue from "vue";

Vue.use(Loading);
Vue.use(Button);
Vue.use(Input);
Vue.use(InputNumber);
Vue.use(Switch);
Vue.use(Select);
Vue.use(Option);
Vue.use(Form);
Vue.use(FormItem);
Vue.use(Tooltip);
Vue.use(Radio);
Vue.use(RadioGroup);
Vue.use(Checkbox);
Vue.use(CheckboxGroup);
Vue.use(Table);
Vue.use(TableColumn);
Vue.use(Pagination);
Vue.use(Slider);
Vue.use(Popover);
Vue.use(Link);
Vue.use(Tree);
Vue.use(Autocomplete);
Vue.use(Dropdown);
Vue.use(DropdownItem);
Vue.use(DropdownMenu);
Vue.use(Upload);
Vue.use(Tag);
Vue.use(Radio);
Vue.use(OptionGroup);
Vue.use(RadioGroup);
Vue.use(RadioButton);
Vue.use(Image);
Vue.use(Descriptions);
Vue.use(DescriptionsItem);
Vue.use(Card);
Vue.use(Divider);
Vue.use(Progress);

Vue.prototype.$alert = MessageBox.alert;
Vue.prototype.$message = Message;
Vue.prototype.$confirm = MessageBox.confirm;
Vue.prototype.$loading = Loading.service;
Vue.prototype.$prompt = MessageBox.prompt;
Vue.prototype.$notify = Notification;

Vue.prototype.$ELEMENT = {
    size: 'small',
    zIndex: 1000,
};