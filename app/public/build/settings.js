
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35730/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var settings = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.58.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* DashlyticsSettings.svelte generated by Svelte v3.58.0 */

    const { Object: Object_1, console: console_1 } = globals;
    const file = "DashlyticsSettings.svelte";

    // (138:28) {#if Object.keys(data).length > 0}
    function create_if_block(ctx) {
    	let h2;
    	let t1;
    	let pre;
    	let t2_value = JSON.stringify(/*data*/ ctx[0], null, 2) + "";
    	let t2;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "Daten:";
    			t1 = space();
    			pre = element("pre");
    			t2 = text(t2_value);
    			add_location(h2, file, 138, 28, 4914);
    			add_location(pre, file, 139, 32, 4962);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, pre, anchor);
    			append_dev(pre, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data*/ 1 && t2_value !== (t2_value = JSON.stringify(/*data*/ ctx[0], null, 2) + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(pre);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(138:28) {#if Object.keys(data).length > 0}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div19;
    	let h1;
    	let t1;
    	let div0;
    	let input0;
    	let t2;
    	let div18;
    	let form;
    	let div6;
    	let div5;
    	let div4;
    	let div1;
    	let h20;
    	let t4;
    	let div3;
    	let h30;
    	let t6;
    	let i0;
    	let t7;
    	let b0;
    	let br0;
    	let t9;
    	let t10;
    	let t11;
    	let input1;
    	let input1_placeholder_value;
    	let t12;
    	let h31;
    	let t14;
    	let i1;
    	let t15;
    	let b1;
    	let br1;
    	let t17;
    	let input2;
    	let br2;
    	let t18;
    	let div2;
    	let button;
    	let t20;
    	let show_if = Object.keys(/*data*/ ctx[0]).length > 0;
    	let t21;
    	let div11;
    	let div10;
    	let div9;
    	let div7;
    	let h21;
    	let t23;
    	let div8;
    	let i2;
    	let t24;
    	let b2;
    	let t26;
    	let a0;
    	let br3;
    	let t28;
    	let i3;
    	let t29;
    	let b3;
    	let t31;
    	let img0;
    	let img0_src_value;
    	let t32;
    	let br4;
    	let t33;
    	let i4;
    	let t34;
    	let b4;
    	let br5;
    	let t36;
    	let i5;
    	let t37;
    	let b5;
    	let t39;
    	let br6;
    	let t40;
    	let i6;
    	let t41;
    	let b6;
    	let t43;
    	let code0;
    	let t45;
    	let code1;
    	let br7;
    	let t47;
    	let i7;
    	let t48;
    	let b7;
    	let t50;
    	let code2;
    	let t52;
    	let br8;
    	let t53;
    	let br9;
    	let t54;
    	let span;
    	let b8;
    	let t56;
    	let input3;
    	let br10;
    	let t57;
    	let br11;
    	let t58;
    	let div17;
    	let div16;
    	let div15;
    	let div12;
    	let h22;
    	let t60;
    	let div14;
    	let img1;
    	let img1_src_value;
    	let t61;
    	let br12;
    	let t62;
    	let p0;
    	let t64;
    	let p1;
    	let t65;
    	let a1;
    	let t67;
    	let p2;
    	let t69;
    	let div13;
    	let a2;
    	let t71;
    	let a3;
    	let mounted;
    	let dispose;
    	let if_block = show_if && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div19 = element("div");
    			h1 = element("h1");
    			h1.textContent = `${/*SettingsTitle*/ ctx[1]}`;
    			t1 = space();
    			div0 = element("div");
    			input0 = element("input");
    			t2 = space();
    			div18 = element("div");
    			form = element("form");
    			div6 = element("div");
    			div5 = element("div");
    			div4 = element("div");
    			div1 = element("div");
    			h20 = element("h2");
    			h20.textContent = "API Settings";
    			t4 = space();
    			div3 = element("div");
    			h30 = element("h3");
    			h30.textContent = "Api Url";
    			t6 = space();
    			i0 = element("i");
    			t7 = text("Standard Matomo Api Url: ");
    			b0 = element("b");
    			b0.textContent = "?rest_route=/matomo/v1/api/";
    			br0 = element("br");
    			t9 = space();
    			t10 = text(wholeUrl);
    			t11 = space();
    			input1 = element("input");
    			t12 = space();
    			h31 = element("h3");
    			h31.textContent = "Site Id";
    			t14 = space();
    			i1 = element("i");
    			t15 = text("Standard Site Id: ");
    			b1 = element("b");
    			b1.textContent = "1";
    			br1 = element("br");
    			t17 = space();
    			input2 = element("input");
    			br2 = element("br");
    			t18 = space();
    			div2 = element("div");
    			button = element("button");
    			button.textContent = "Save Changes";
    			t20 = space();
    			if (if_block) if_block.c();
    			t21 = space();
    			div11 = element("div");
    			div10 = element("div");
    			div9 = element("div");
    			div7 = element("div");
    			h21 = element("h2");
    			h21.textContent = "Auth Token";
    			t23 = space();
    			div8 = element("div");
    			i2 = element("i");
    			t24 = text("1. Go to your ");
    			b2 = element("b");
    			b2.textContent = "Matomo Dashboard";
    			t26 = space();
    			a0 = element("a");
    			a0.textContent = "Matomo Dashboard";
    			br3 = element("br");
    			t28 = space();
    			i3 = element("i");
    			t29 = text("2. Click on the ");
    			b3 = element("b");
    			b3.textContent = "Export Button";
    			t31 = space();
    			img0 = element("img");
    			t32 = text(" Icon of \"last visits\"");
    			br4 = element("br");
    			t33 = space();
    			i4 = element("i");
    			t34 = text("3. Export Metrics as ");
    			b4 = element("b");
    			b4.textContent = "HTML or JSON";
    			br5 = element("br");
    			t36 = space();
    			i5 = element("i");
    			t37 = text("4. Have a look on the ");
    			b5 = element("b");
    			b5.textContent = "Video above";
    			t39 = text(" 😎");
    			br6 = element("br");
    			t40 = space();
    			i6 = element("i");
    			t41 = text("5. Look into our ");
    			b6 = element("b");
    			b6.textContent = "Website Url";
    			t43 = text(" (i.E.\n                            ");
    			code0 = element("code");
    			code0.textContent = "http://domain...&token_auth=00e3dwwdewDew...";
    			t45 = text(" ) --> find\n                            ");
    			code1 = element("code");
    			code1.textContent = "token_auth";
    			br7 = element("br");
    			t47 = space();
    			i7 = element("i");
    			t48 = text("6. Copy the Value of your Url ");
    			b7 = element("b");
    			b7.textContent = "after";
    			t50 = space();
    			code2 = element("code");
    			code2.textContent = "token_auth=";
    			t52 = text(" and paste it\n                            below to request data from your Matomo");
    			br8 = element("br");
    			t53 = space();
    			br9 = element("br");
    			t54 = space();
    			span = element("span");
    			b8 = element("b");
    			b8.textContent = "Insert your Auth token here:";
    			t56 = space();
    			input3 = element("input");
    			br10 = element("br");
    			t57 = space();
    			br11 = element("br");
    			t58 = space();
    			div17 = element("div");
    			div16 = element("div");
    			div15 = element("div");
    			div12 = element("div");
    			h22 = element("h2");
    			h22.textContent = "Video find Auth Token";
    			t60 = space();
    			div14 = element("div");
    			img1 = element("img");
    			t61 = space();
    			br12 = element("br");
    			t62 = space();
    			p0 = element("p");
    			p0.textContent = "Thanks for choosing the Plugin! 🎉 Keep in mind it's in beta, so expect some quirks\n                                😅.\n                                We're always working to improve it.";
    			t64 = space();
    			p1 = element("p");
    			t65 = text("Feel like supporting Christopher, the developer? He'd be grateful for a small\n                                donation, like a coffee ☕ or snack 🍪:\n                                ");
    			a1 = element("a");
    			a1.textContent = "Buy me a ☕\n                                    or 🍪";
    			t67 = space();
    			p2 = element("p");
    			p2.textContent = "Stay awesome 😎 and enjoy the plugin!";
    			t69 = space();
    			div13 = element("div");
    			a2 = element("a");
    			a2.textContent = "Support Plugin Developer";
    			t71 = space();
    			a3 = element("a");
    			a3.textContent = "Plugin Github Repository";
    			add_location(h1, file, 110, 4, 3172);
    			attr_dev(input0, "type", "hidden");
    			attr_dev(input0, "id", "welcomepanelnonce");
    			attr_dev(input0, "name", "welcomepanelnonce");
    			input0.value = "1";
    			add_location(input0, file, 112, 8, 3263);
    			attr_dev(div0, "id", "welcome-panel");
    			attr_dev(div0, "class", "welcome-panel hidden");
    			add_location(div0, file, 111, 4, 3201);
    			attr_dev(h20, "class", "hndle ui-sortable-handle");
    			add_location(h20, file, 121, 28, 3756);
    			attr_dev(div1, "class", "postbox-header");
    			add_location(div1, file, 120, 24, 3699);
    			set_style(h30, "margin-top", "14px");
    			add_location(h30, file, 124, 28, 3915);
    			add_location(b0, file, 125, 56, 4013);
    			attr_dev(i0, "class", "svelte-1sityi8");
    			add_location(i0, file, 125, 28, 3985);
    			add_location(br0, file, 125, 94, 4051);
    			attr_dev(input1, "class", "Settings--input svelte-1sityi8");
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "name", "api_url");
    			attr_dev(input1, "placeholder", input1_placeholder_value = /*data*/ ctx[0].apiurl);
    			add_location(input1, file, 127, 28, 4125);
    			set_style(h31, "margin-top", "14px");
    			add_location(h31, file, 128, 28, 4265);
    			add_location(b1, file, 129, 49, 4356);
    			attr_dev(i1, "class", "svelte-1sityi8");
    			add_location(i1, file, 129, 28, 4335);
    			add_location(br1, file, 129, 61, 4368);
    			attr_dev(input2, "class", "Settings--input svelte-1sityi8");
    			attr_dev(input2, "type", "number");
    			attr_dev(input2, "name", "site_id_arl");
    			add_location(input2, file, 130, 28, 4403);
    			add_location(br2, file, 131, 62, 4529);
    			attr_dev(button, "type", "submit");
    			attr_dev(button, "class", "Settings--button button button-primary svelte-1sityi8");
    			add_location(button, file, 133, 32, 4627);
    			set_style(div2, "max-height", "44px");
    			add_location(div2, file, 132, 28, 4564);
    			attr_dev(div3, "class", "inside");
    			add_location(div3, file, 123, 24, 3866);
    			attr_dev(div4, "id", "api-settings");
    			attr_dev(div4, "class", "postbox ");
    			add_location(div4, file, 119, 20, 3634);
    			attr_dev(div5, "class", "meta-box-sortables ui-sortable");
    			add_location(div5, file, 118, 16, 3569);
    			attr_dev(div6, "class", "postbox-container");
    			add_location(div6, file, 117, 12, 3521);
    			attr_dev(h21, "class", "hndle ui-sortable-handle");
    			add_location(h21, file, 149, 28, 5384);
    			attr_dev(div7, "class", "postbox-header");
    			add_location(div7, file, 148, 24, 5327);
    			add_location(b2, file, 152, 45, 5558);
    			attr_dev(a0, "href", "/wp-content/plugins/matomo/app/index.php");
    			attr_dev(a0, "target", "_blank");
    			add_location(a0, file, 152, 69, 5582);
    			attr_dev(i2, "class", "svelte-1sityi8");
    			add_location(i2, file, 152, 28, 5541);
    			add_location(br3, file, 154, 76, 5745);
    			add_location(b3, file, 155, 47, 5797);
    			set_style(img0, "object-fit", "cover");
    			set_style(img0, "width", "24px");
    			set_style(img0, "height", "18px");
    			set_style(img0, "transform", "translateY(3px)");
    			if (!src_url_equal(img0.src, img0_src_value = /*shareImageUri*/ ctx[3])) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "share logo");
    			add_location(img0, file, 155, 68, 5818);
    			attr_dev(i3, "class", "svelte-1sityi8");
    			add_location(i3, file, 155, 28, 5778);
    			add_location(br4, file, 157, 103, 6037);
    			add_location(b4, file, 158, 52, 6094);
    			attr_dev(i4, "class", "svelte-1sityi8");
    			add_location(i4, file, 158, 28, 6070);
    			add_location(br5, file, 158, 75, 6117);
    			add_location(b5, file, 159, 53, 6175);
    			attr_dev(i5, "class", "svelte-1sityi8");
    			add_location(i5, file, 159, 28, 6150);
    			add_location(br6, file, 159, 78, 6200);
    			add_location(b6, file, 160, 48, 6253);
    			attr_dev(i6, "class", "svelte-1sityi8");
    			add_location(i6, file, 160, 28, 6233);
    			add_location(code0, file, 161, 28, 6310);
    			add_location(code1, file, 162, 28, 6407);
    			add_location(br7, file, 162, 51, 6430);
    			add_location(b7, file, 163, 61, 6496);
    			attr_dev(i7, "class", "svelte-1sityi8");
    			add_location(i7, file, 163, 28, 6463);
    			add_location(code2, file, 163, 78, 6513);
    			add_location(br8, file, 164, 66, 6617);
    			add_location(br9, file, 165, 28, 6650);
    			add_location(b8, file, 167, 32, 6783);
    			attr_dev(input3, "class", "Settings--input svelte-1sityi8");
    			attr_dev(input3, "type", "text");
    			attr_dev(input3, "minlength", "32");
    			attr_dev(input3, "name", "token_auth");
    			add_location(input3, file, 168, 32, 6851);
    			add_location(br10, file, 169, 56, 6993);
    			set_style(span, "background", "#f5f5f5");
    			set_style(span, "width", "100%");
    			set_style(span, "padding", "1.1rem 1.2rem");
    			add_location(span, file, 166, 28, 6683);
    			add_location(br11, file, 171, 28, 7062);
    			attr_dev(div8, "class", "inside");
    			add_location(div8, file, 151, 24, 5492);
    			attr_dev(div9, "id", "auth-token");
    			attr_dev(div9, "class", "postbox ");
    			add_location(div9, file, 147, 20, 5264);
    			attr_dev(div10, "class", "meta-box-sortables ui-sortable");
    			add_location(div10, file, 146, 16, 5199);
    			attr_dev(div11, "class", "postbox-container");
    			add_location(div11, file, 145, 12, 5151);
    			attr_dev(h22, "class", "hndle ui-sortable-handle");
    			add_location(h22, file, 180, 28, 7410);
    			attr_dev(div12, "class", "postbox-header");
    			add_location(div12, file, 179, 24, 7353);
    			if (!src_url_equal(img1.src, img1_src_value = /*settingsTutorialGif*/ ctx[2])) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "Gif Tutorial how to find the scret token api");
    			set_style(img1, "width", "100%");
    			set_style(img1, "object-fit", "contain");
    			add_location(img1, file, 183, 28, 7578);
    			add_location(br12, file, 185, 28, 7760);
    			add_location(p0, file, 186, 28, 7793);
    			attr_dev(a1, "href", "https://www.paypal.com/paypalme/choooomedia/4");
    			attr_dev(a1, "target", "_blank");
    			add_location(a1, file, 191, 32, 8200);
    			add_location(p1, file, 189, 28, 8016);
    			add_location(p2, file, 194, 28, 8390);
    			attr_dev(a2, "class", "Settings--button button button-primary svelte-1sityi8");
    			attr_dev(a2, "href", "https://www.paypal.com/paypalme/choooomedia/4");
    			attr_dev(a2, "target", "_blank");
    			set_style(a2, "height", "28px");
    			set_style(a2, "margin-top", "5px");
    			add_location(a2, file, 196, 32, 8516);
    			attr_dev(a3, "class", "Settings--button button button-primary svelte-1sityi8");
    			attr_dev(a3, "href", "https://github.com/chooomedia/wp-dashboard-statistics-widget-matomo");
    			attr_dev(a3, "target", "_blank");
    			set_style(a3, "height", "28px");
    			set_style(a3, "margin-top", "5px");
    			add_location(a3, file, 199, 32, 8804);
    			attr_dev(div13, "class", "d-flex svelte-1sityi8");
    			add_location(div13, file, 195, 28, 8463);
    			attr_dev(div14, "class", "inside");
    			add_location(div14, file, 182, 24, 7529);
    			attr_dev(div15, "id", "dev-infos");
    			attr_dev(div15, "class", "postbox");
    			add_location(div15, file, 178, 20, 7292);
    			attr_dev(div16, "class", "meta-box-sortables ui-sortable");
    			add_location(div16, file, 177, 16, 7227);
    			attr_dev(div17, "class", "postbox-container");
    			add_location(div17, file, 176, 12, 7179);
    			attr_dev(form, "id", "dashboard-widgets");
    			attr_dev(form, "class", "metabox-holder");
    			add_location(form, file, 116, 8, 3431);
    			attr_dev(div18, "id", "dashboard-settings-wrap");
    			attr_dev(div18, "class", "dashboard-settings");
    			add_location(div18, file, 115, 4, 3361);
    			attr_dev(div19, "class", "wrap");
    			add_location(div19, file, 109, 0, 3149);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div19, anchor);
    			append_dev(div19, h1);
    			append_dev(div19, t1);
    			append_dev(div19, div0);
    			append_dev(div0, input0);
    			append_dev(div19, t2);
    			append_dev(div19, div18);
    			append_dev(div18, form);
    			append_dev(form, div6);
    			append_dev(div6, div5);
    			append_dev(div5, div4);
    			append_dev(div4, div1);
    			append_dev(div1, h20);
    			append_dev(div4, t4);
    			append_dev(div4, div3);
    			append_dev(div3, h30);
    			append_dev(div3, t6);
    			append_dev(div3, i0);
    			append_dev(i0, t7);
    			append_dev(i0, b0);
    			append_dev(div3, br0);
    			append_dev(div3, t9);
    			append_dev(div3, t10);
    			append_dev(div3, t11);
    			append_dev(div3, input1);
    			set_input_value(input1, /*data*/ ctx[0].apiurl);
    			append_dev(div3, t12);
    			append_dev(div3, h31);
    			append_dev(div3, t14);
    			append_dev(div3, i1);
    			append_dev(i1, t15);
    			append_dev(i1, b1);
    			append_dev(div3, br1);
    			append_dev(div3, t17);
    			append_dev(div3, input2);
    			set_input_value(input2, /*data*/ ctx[0].siteidarl);
    			append_dev(div3, br2);
    			append_dev(div3, t18);
    			append_dev(div3, div2);
    			append_dev(div2, button);
    			append_dev(div3, t20);
    			if (if_block) if_block.m(div3, null);
    			append_dev(form, t21);
    			append_dev(form, div11);
    			append_dev(div11, div10);
    			append_dev(div10, div9);
    			append_dev(div9, div7);
    			append_dev(div7, h21);
    			append_dev(div9, t23);
    			append_dev(div9, div8);
    			append_dev(div8, i2);
    			append_dev(i2, t24);
    			append_dev(i2, b2);
    			append_dev(i2, t26);
    			append_dev(i2, a0);
    			append_dev(div8, br3);
    			append_dev(div8, t28);
    			append_dev(div8, i3);
    			append_dev(i3, t29);
    			append_dev(i3, b3);
    			append_dev(i3, t31);
    			append_dev(i3, img0);
    			append_dev(i3, t32);
    			append_dev(div8, br4);
    			append_dev(div8, t33);
    			append_dev(div8, i4);
    			append_dev(i4, t34);
    			append_dev(i4, b4);
    			append_dev(div8, br5);
    			append_dev(div8, t36);
    			append_dev(div8, i5);
    			append_dev(i5, t37);
    			append_dev(i5, b5);
    			append_dev(div8, t39);
    			append_dev(div8, br6);
    			append_dev(div8, t40);
    			append_dev(div8, i6);
    			append_dev(i6, t41);
    			append_dev(i6, b6);
    			append_dev(div8, t43);
    			append_dev(div8, code0);
    			append_dev(div8, t45);
    			append_dev(div8, code1);
    			append_dev(div8, br7);
    			append_dev(div8, t47);
    			append_dev(div8, i7);
    			append_dev(i7, t48);
    			append_dev(i7, b7);
    			append_dev(i7, t50);
    			append_dev(div8, code2);
    			append_dev(div8, t52);
    			append_dev(div8, br8);
    			append_dev(div8, t53);
    			append_dev(div8, br9);
    			append_dev(div8, t54);
    			append_dev(div8, span);
    			append_dev(span, b8);
    			append_dev(span, t56);
    			append_dev(span, input3);
    			set_input_value(input3, /*data*/ ctx[0].tokenauth);
    			append_dev(span, br10);
    			append_dev(div8, t57);
    			append_dev(div8, br11);
    			append_dev(form, t58);
    			append_dev(form, div17);
    			append_dev(div17, div16);
    			append_dev(div16, div15);
    			append_dev(div15, div12);
    			append_dev(div12, h22);
    			append_dev(div15, t60);
    			append_dev(div15, div14);
    			append_dev(div14, img1);
    			append_dev(div14, t61);
    			append_dev(div14, br12);
    			append_dev(div14, t62);
    			append_dev(div14, p0);
    			append_dev(div14, t64);
    			append_dev(div14, p1);
    			append_dev(p1, t65);
    			append_dev(p1, a1);
    			append_dev(div14, t67);
    			append_dev(div14, p2);
    			append_dev(div14, t69);
    			append_dev(div14, div13);
    			append_dev(div13, a2);
    			append_dev(div13, t71);
    			append_dev(div13, a3);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[5]),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[6]),
    					listen_dev(input3, "input", /*input3_input_handler*/ ctx[7]),
    					listen_dev(form, "submit", /*handleSubmit*/ ctx[4], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*data*/ 1 && input1_placeholder_value !== (input1_placeholder_value = /*data*/ ctx[0].apiurl)) {
    				attr_dev(input1, "placeholder", input1_placeholder_value);
    			}

    			if (dirty & /*data*/ 1 && input1.value !== /*data*/ ctx[0].apiurl) {
    				set_input_value(input1, /*data*/ ctx[0].apiurl);
    			}

    			if (dirty & /*data*/ 1 && to_number(input2.value) !== /*data*/ ctx[0].siteidarl) {
    				set_input_value(input2, /*data*/ ctx[0].siteidarl);
    			}

    			if (dirty & /*data*/ 1) show_if = Object.keys(/*data*/ ctx[0]).length > 0;

    			if (show_if) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(div3, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*data*/ 1 && input3.value !== /*data*/ ctx[0].tokenauth) {
    				set_input_value(input3, /*data*/ ctx[0].tokenauth);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div19);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const wholeUrl = 'http://wordpress-local:8888/index.php';
    const matomoRestUrl = '?rest_route=/matomo/v1/api/';
    const restUrl = '/wp-json/dashlytics/v1/options';

    async function updateData() {
    	const isTokenValid = await getData();

    	if (isTokenValid) {
    		// Do something with the data
    		console.log('Data is valid');
    	} else {
    		// Handle invalid token error
    		console.log('Data is invalid');
    	}
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('DashlyticsSettings', slots, []);
    	let SettingsTitle = 'Dashlytic Settings';
    	let settingsTutorialGif = '../wp-content/plugins/wp-dashlytics/assets/how-to-show-matomo-token-for-reporting-api.gif';
    	let shareImageUri = '';
    	let data = {};

    	// Function who checks if request token for matomo valid if not generate new one and write into REST Plugin Api
    	async function checkToken() {
    		try {
    			const response = await fetch(`${wholeUrl}/${matomoRestUrl}`, {
    				headers: {
    					Authorization: `Bearer ${data.authtoken}`
    				}
    			});

    			if (response.ok) {
    				// Token is valid
    				console.log('Token is valid');

    				return true;
    			} else if (response.status === 404) {
    				// Token is invalid, generate new token
    				console.log('Generating new token...');

    				const newTokenResponse = await fetch(`${wholeUrl}/${matomoRestUrl}`, { method: 'POST' });

    				if (newTokenResponse.ok) {
    					// Update tokenauth variable with new token
    					const newToken = await newTokenResponse.text();

    					await fetch(restUrl, {
    						method: 'POST',
    						headers: { 'Content-Type': 'application/json' },
    						body: JSON.stringify({ tokenauth: newToken })
    					});

    					console.log('Token updated successfully');
    					return true;
    				} else {
    					console.log('Failed to generate new token');
    					return false;
    				}
    			} else {
    				console.log(`Error: ${response.status} - ${response.statusText}`);
    				return false;
    			}
    		} catch(error) {
    			console.log(`Error: ${error}`);
    			return false;
    		}
    	}

    	// Loads Data from REST Plugin route
    	async function loadRestData() {
    		const response = await fetch(`${restUrl}`);
    		$$invalidate(0, data = await response.json());
    	}

    	// Function for save Values from form into REST Plugin route
    	async function saveChanges() {
    		const response = await fetch(`${restUrl}`, {
    			method: 'POST',
    			headers: { 'Content-Type': 'application/json' },
    			body: JSON.stringify({
    				apiurl: data.apiurl,
    				siteidarl: data.siteidarl,
    				tokenauth: data.tokenauth
    			})
    		});

    		const responseData = await response.json();
    		console.log(responseData);
    	}

    	// Saves data values for Plugin from form input values
    	async function handleSubmit(event) {
    		event.preventDefault();
    		const savedData = await saveChanges();
    		console.log('Saved Data:', savedData);
    	}

    	onMount(() => {
    		loadRestData();
    	});

    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<DashlyticsSettings> was created with unknown prop '${key}'`);
    	});

    	function input1_input_handler() {
    		data.apiurl = this.value;
    		$$invalidate(0, data);
    	}

    	function input2_input_handler() {
    		data.siteidarl = to_number(this.value);
    		$$invalidate(0, data);
    	}

    	function input3_input_handler() {
    		data.tokenauth = this.value;
    		$$invalidate(0, data);
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		SettingsTitle,
    		settingsTutorialGif,
    		shareImageUri,
    		data,
    		wholeUrl,
    		matomoRestUrl,
    		restUrl,
    		checkToken,
    		loadRestData,
    		saveChanges,
    		handleSubmit,
    		updateData
    	});

    	$$self.$inject_state = $$props => {
    		if ('SettingsTitle' in $$props) $$invalidate(1, SettingsTitle = $$props.SettingsTitle);
    		if ('settingsTutorialGif' in $$props) $$invalidate(2, settingsTutorialGif = $$props.settingsTutorialGif);
    		if ('shareImageUri' in $$props) $$invalidate(3, shareImageUri = $$props.shareImageUri);
    		if ('data' in $$props) $$invalidate(0, data = $$props.data);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		data,
    		SettingsTitle,
    		settingsTutorialGif,
    		shareImageUri,
    		handleSubmit,
    		input1_input_handler,
    		input2_input_handler,
    		input3_input_handler
    	];
    }

    class DashlyticsSettings extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "DashlyticsSettings",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    new DashlyticsSettings({
        target: document.querySelector('#dashlytics-settings')
    });

    return DashlyticsSettings;

})();
//# sourceMappingURL=settings.js.map
