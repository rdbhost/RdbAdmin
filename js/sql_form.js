//
//
function results_loaded() {
	var fr = $(frames['upload_target'].document).find('body');
	var cont = fr.html();
	alert('content:'+cont);
	if ( cont ) {
		cont = cont.replace(/^\s*<pr[^>]+>/,''); // remove opening pre
		cont = cont.replace(/<[/]pr[^>]+\s*>$/,''); // remove end pre
		var data = eval("("+cont+")");
		var stat = data['status'][0];
		alert('data status: '+stat);
	}
	else {
		alert('no data loaded');
		fr.append('<form id="rdbhost-iframe-form">0</form>');
	}
}

$(document).ready(function () {
	$('#xmlentry').submit(function () {
		  this.action = 'https://'+window.location.hostname+'/db/'+this.u.value;
          return true;
    });
	var iframeTxt = '<iframe id="upload_target" name="upload_target" src="" '+
					'style="width:200px;height:100px;border:1px solid #ccc;" '+
					'><html><body></body></html></iframe>';
	$('body').append($(iframeTxt));
	var frame = $(frames['upload_target'].document).find('body');
	frame.append('<p>ABCD</p>');
	function rl() { results_loaded(); $('#upload_target').load(rl) }
	$('#upload_target').load(rl);
	frame.append('DEF');
	
	function doinput(id0) {
	  var id = this.id.substring(2,20);
	  var mode = this.mode;
	  if (mode == 'file') { wanttext(id); }
	  else { wantfile(id); }
	}
	function wanttext(id) {
	  from = document.getElementById(id);
	  to = document.getElementById('t_'+id);
	  lbl = document.getElementById('l_'+id);
	  from.name = from.id = 'f_'+id;
	  from.style.display = 'none';
	  to.name = to.id = id;
	  to.style.display = 'inline';
	  lbl.innerHTML = 'load from file';
	  lbl.mode = 'text';
	  return false;
	};
    function wantfile(id) {
	  from = document.getElementById(id);
	  to = document.getElementById('f_'+id);
	  lbl = document.getElementById('l_'+id);
	  from.name = from.id = 't_'+id;
	  from.style.display = 'none';
	  to.name = to.id = id;
	  to.style.display = 'inline';
	  lbl.innerHTML = 'text input';
	  lbl.mode = 'file';
	  return false;
	};
	$("a[id*=l_arg0]").click(doinput);
});	
